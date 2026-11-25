// Read the standing instructions the user writes for every request, and the skill guides for the tasks that use them.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { appIdentity, configDirectory, instructionsFileNames } from './identity.js';
import { expandUser } from './settings.js';
export { configDirectory };
// ============================================================================
// Where the user's files live
// ============================================================================
// Instructions go into every model call, so they are kept short enough to leave room for the work itself.
export const MAX_INSTRUCTIONS_CHARS = 4000;
// Section headings the code writes and matches, so they stay in code rather than share/prompts/.
export const INSTRUCTIONS_LABEL = 'Standing instructions from the user';
export function globalInstructionsPath() {
    return join(configDirectory(), instructionsFileNames()[0]);
}
// Return the folder's instructions file, or null when it has none.
export function projectInstructionsPath(filesystemRoot) {
    const root = resolve(expandUser(filesystemRoot));
    for (const name of instructionsFileNames()) {
        const path = join(root, name);
        try {
            if (statSync(path).isFile()) {
                return path;
            }
        }
        catch {
            // A missing file means the next name is tried.
        }
    }
    return null;
}
// ============================================================================
// Reading the instructions
// ============================================================================
// Return the global instructions, then the folder's own, or an empty string when there are none.
export function loadInstructions(filesystemRoot) {
    const paths = [globalInstructionsPath(), projectInstructionsPath(filesystemRoot)];
    const parts = [];
    for (const path of new Set(paths.filter((path) => path !== null))) {
        let text;
        try {
            text = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path)).trim();
        }
        catch {
            continue;
        }
        if (text) {
            parts.push(text);
        }
    }
    let instructions = parts.join('\n\n');
    if (instructions.length > MAX_INSTRUCTIONS_CHARS) {
        instructions = instructions.slice(0, MAX_INSTRUCTIONS_CHARS) + '\n[Cut: the instructions are longer than the limit.]';
    }
    return instructions;
}
// ============================================================================
// Skills and guides
// ============================================================================
// Each skill store has a folder of Markdown guides, global and per folder.
export const SKILL_FOLDERS = { research: 'research', code: 'code' };
// Guides go into every call of a task that uses them, so they are kept as short as instructions.
export const MAX_SKILLS_CHARS = 3000;
export const SKILLS_LABEL = 'Skills and guides from the user';
// Return where a skill store's guides live, the global folder first and the folder's own last.
export function skillDirectories(filesystemRoot, store) {
    const root = resolve(expandUser(filesystemRoot));
    return [join(configDirectory(), 'skills', SKILL_FOLDERS[store]), join(root, appIdentity().projectFolderName, 'skills', SKILL_FOLDERS[store])];
}
function guideFiles(directory) {
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
// Return the user's guides for one skill store, or an empty string when there are none.
export function loadSkills(filesystemRoot, store) {
    const parts = [];
    for (const directory of new Set(skillDirectories(filesystemRoot, store))) {
        for (const path of guideFiles(directory)) {
            let text;
            try {
                text = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path)).trim();
            }
            catch {
                continue;
            }
            if (text) {
                parts.push(text);
            }
        }
    }
    let skills = parts.join('\n\n');
    if (skills.length > MAX_SKILLS_CHARS) {
        skills = skills.slice(0, MAX_SKILLS_CHARS) + '\n[Cut: the guides are longer than the limit.]';
    }
    return skills;
}
