// Slash commands: memory commands answered without the model, /init, and commands the user defines in files.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { appIdentity, configDirectory, instructionsFileNames } from './identity.js';
import { projectInstructionsPath } from './instructions.js';
import { MEMORY_STORES, MEMORY_STORE_LABELS, SCOPED_MEMORY_STORES, casefold } from './knowledge.js';
import { prompt } from './prompts.js';
import { expandUser } from './settings.js';
// ============================================================================
// Memory commands
// ============================================================================
export const MEMORY_COMMANDS = ['/remember', '/forget', '/memories'];
// "Why:" starts the reason a remembered statement holds.
const REASON = /\s*\bwhy:\s*/i;
// Other words /remember takes for a store, including the kinds memories had before there were stores.
export const STORE_ALIASES = {
    preference: 'user',
    correction: 'user',
    reference: 'locations',
    location: 'locations',
    files: 'locations',
    folders: 'locations',
    environment: 'locations',
    skill: 'code',
};
// Return the prompt's leading word in lower case and the text after it.
function commandWord(userPrompt) {
    const trimmed = userPrompt.trim();
    const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(trimmed);
    if (!match || !match[1].startsWith('/')) {
        return ['', userPrompt];
    }
    return [match[1].toLowerCase(), (match[2] ?? '').trim()];
}
export function isMemoryCommand(userPrompt) {
    return MEMORY_COMMANDS.includes(commandWord(userPrompt)[0]);
}
// Carry out /remember, /forget, or /memories and return the reply to show.
export function runMemoryCommand(userPrompt, knowledgeStore, scope) {
    const [command, text] = commandWord(userPrompt);
    if (knowledgeStore === null) {
        return 'There is no knowledge store to keep memories in; set knowledge_db_path in the settings.';
    }
    if (command === '/remember') {
        return remember(knowledgeStore, text, scope);
    }
    if (command === '/forget') {
        return forget(knowledgeStore, text, scope);
    }
    return listMemories(knowledgeStore, text, scope);
}
// Returns the store a word names, directly or by an alias, or null.
function storeWord(word) {
    const name = casefold(word).replace(/:+$/, '');
    return MEMORY_STORES.includes(name) ? name : (STORE_ALIASES[name] ?? null);
}
function remember(knowledgeStore, text, scope) {
    const stores = MEMORY_STORES.join(', ');
    const space = text.indexOf(' ');
    const firstWord = space === -1 ? text : text.slice(0, space);
    let store = storeWord(firstWord);
    if (store !== null) {
        text = space === -1 ? '' : text.slice(space + 1).trim();
    }
    else {
        store = 'user';
    }
    const reasonStart = REASON.exec(text);
    let statement = reasonStart ? text.slice(0, reasonStart.index) : text;
    const reason = reasonStart ? text.slice(reasonStart.index + reasonStart[0].length) : '';
    statement = statement.trim();
    if (!statement) {
        return `Say what to remember, for example: /remember user Answer in British English. Why: I work in the UK. Stores: ${stores}.`;
    }
    const memoryId = knowledgeStore.addMemory(store, statement, { reason: reason.trim(), origin: 'user', scope });
    const where = SCOPED_MEMORY_STORES.includes(store) ? ' for this folder' : '';
    return `Remembered${where} as memory ${memoryId} (${store}): ${statement}`;
}
function forget(knowledgeStore, text, scope) {
    if (!text) {
        return 'Say which memory to forget: its number from /memories, or words from it.';
    }
    const memories = knowledgeStore.memories({ limit: 10_000, scope });
    let matches;
    if (/^\d+$/.test(text)) {
        matches = memories.filter((memory) => memory.id === Number(text));
    }
    else {
        const words = text.toLowerCase().split(/\s+/).filter(Boolean);
        matches = memories.filter((memory) => words.every((word) => memory.statement.toLowerCase().includes(word)));
    }
    if (matches.length === 0) {
        return `No memory matches '${text}'. List them with /memories.`;
    }
    if (matches.length > 1) {
        // Deleting cannot be undone, so several matches are listed instead of all being forgotten.
        return 'Several memories match; forget one by its number:\n' + memoryLines(matches, true);
    }
    knowledgeStore.forgetMemory(matches[0].id);
    return `Forgot memory ${matches[0].id}: ${matches[0].statement}`;
}
// Lists the memories for this folder under each store's heading, or only one store's when one is named.
function listMemories(knowledgeStore, text, scope) {
    const store = text ? storeWord(text) : null;
    if (text && store === null) {
        return `There is no memory store called '${text}'. Stores: ${MEMORY_STORES.join(', ')}.`;
    }
    const memories = knowledgeStore.memories({ limit: 10_000, scope, stores: store ? [store] : MEMORY_STORES });
    if (memories.length === 0) {
        return 'No memories yet. Add one with /remember.';
    }
    const groups = [];
    for (const name of MEMORY_STORES) {
        const inStore = memories.filter((memory) => memory.store === name);
        if (inStore.length > 0) {
            groups.push(`${MEMORY_STORE_LABELS[name]} (${name}), newest first:\n` + memoryLines(inStore));
        }
    }
    return groups.join('\n\n');
}
function memoryLines(memories, showStore = false) {
    return memories
        .map((memory) => `${memory.id}. ` +
        (showStore ? `[${memory.store}] ` : '') +
        (memory.origin !== 'user' ? `(${memory.origin}) ` : '') +
        memory.statement +
        (memory.reason ? ` Why: ${memory.reason}` : ''))
        .join('\n');
}
// ============================================================================
// Commands the user defines
// ============================================================================
// A command name is one word, so a path such as /etc/hosts at the start of a prompt is never taken for one.
const COMMAND_NAME = /^[a-z0-9][a-z0-9_-]*$/;
const FRONT_MATTER = /^---\s*\n([\s\S]*?)\n---\s*\n?/;
export const COMMAND_MODES = ['answer', 'draft', 'execute'];
export class Command {
    name;
    description;
    mode;
    template;
    path;
    constructor(name, description, mode, template, path) {
        this.name = name;
        this.description = description;
        this.mode = mode;
        this.template = template;
        this.path = path;
    }
}
// Return where command files live, the folder's own last so they win over global ones of the same name.
export function commandDirectories(filesystemRoot) {
    const root = resolve(expandUser(filesystemRoot));
    return [join(configDirectory(), 'commands'), join(root, appIdentity().projectFolderName, 'commands')];
}
function commandFiles(directory) {
    try {
        if (!statSync(directory).isDirectory()) {
            return [];
        }
        return readdirSync(directory)
            .filter((name) => name.endsWith('.md'))
            .map((name) => join(directory, name))
            .sort();
    }
    catch {
        return [];
    }
}
export function loadCommands(filesystemRoot) {
    const commands = new Map();
    for (const directory of commandDirectories(filesystemRoot)) {
        for (const path of commandFiles(directory)) {
            const command = readCommand(path);
            if (command !== null) {
                commands.set(command.name, command);
            }
        }
    }
    return commands;
}
function readCommand(path) {
    const name = basename(path, '.md').toLowerCase();
    if (!COMMAND_NAME.test(name) || MEMORY_COMMANDS.includes(`/${name}`) || name === 'init') {
        return null;
    }
    let text;
    try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path));
    }
    catch {
        return null;
    }
    const fields = {};
    const frontMatter = FRONT_MATTER.exec(text);
    if (frontMatter) {
        for (const line of frontMatter[1].split(/\r\n|\r|\n/)) {
            const separator = line.indexOf(':');
            if (separator !== -1) {
                fields[line.slice(0, separator).trim().toLowerCase()] = line
                    .slice(separator + 1)
                    .trim()
                    .replace(/^["']+|["']+$/g, '');
            }
        }
        text = text.slice(frontMatter[0].length);
    }
    let mode = (fields.mode ?? '').toLowerCase() || null;
    if (mode !== null && !COMMAND_MODES.includes(mode)) {
        mode = null;
    }
    return new Command(name, fields.description ?? '', mode, text.trim(), path);
}
// Put the command's arguments where $ARGUMENTS stands, or after the template when it has no such place.
function fillTemplate(template, argumentsText) {
    if (template.includes('$ARGUMENTS')) {
        return template.split('$ARGUMENTS').join(argumentsText);
    }
    return argumentsText ? `${template}\n\n${argumentsText}`.trim() : template;
}
// ============================================================================
// /init
// ============================================================================
// The /init prompt, naming the instructions file the application reads.
export function initInstructions() {
    return prompt('init', { INSTRUCTIONS_FILE_NAME: instructionsFileNames()[0] });
}
function initPrompt(filesystemRoot, allowFileWrites, argumentsText) {
    const existing = projectInstructionsPath(filesystemRoot);
    let prompt = initInstructions();
    if (existing !== null) {
        prompt += ` ${basename(existing)} already exists: read it, keep what is still right, and improve the rest.`;
    }
    let mode;
    if (allowFileWrites) {
        prompt += ` Write the result to ${instructionsFileNames()[0]} at the top of the folder and change no other file.`;
        mode = 'execute';
    }
    else {
        prompt += " Writing files is turned off, so reply with the file's full text only.";
        mode = 'draft';
    }
    return [mode, fillTemplate(prompt, argumentsText)];
}
// ============================================================================
// Expanding a prompt
// ============================================================================
// Return the mode a leading /init or user command picks, or null, and the prompt it expands to; other prompts come back unchanged.
export function expandCommand(userPrompt, filesystemRoot, allowFileWrites) {
    const [word, argumentsText] = commandWord(userPrompt);
    const name = word.slice(1);
    if (name === 'init') {
        return initPrompt(filesystemRoot, allowFileWrites, argumentsText);
    }
    if (!COMMAND_NAME.test(name)) {
        return [null, userPrompt];
    }
    const command = loadCommands(filesystemRoot).get(name);
    if (command === undefined) {
        return [null, userPrompt];
    }
    return [command.mode, fillTemplate(command.template, argumentsText)];
}
