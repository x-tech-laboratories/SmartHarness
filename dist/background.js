// Background work between requests: research queued topics, learn from past requests, and index knowledge for search by meaning.
import { unsupportedValues } from './checks.js';
import { fitSectionsToTokens, inputTokenBudget, renderSections, tokenCounter } from './contextBudget.js';
import { getEmbedder } from './embeddings.js';
import { queueResearchTopic, summarizeWebPage } from './evidence.js';
import { KnowledgeStore, MEMORY_STORES, WORD, casefold, searchTerms, sharesHalfTheTerms, words } from './knowledge.js';
import { backgroundModelSource, runStage } from './model.js';
import { prompt } from './prompts.js';
import { MAX_TOKENS, TEMPERATURE } from './settings.js';
import { Toolbox } from './tools.js';
// ============================================================================
// Limits and schemas
// ============================================================================
// Pages fetched and summarized per topic, beyond the search snippets.
export const BACKGROUND_PAGES_PER_TOPIC = 2;
// Episodes read per learning pass.
export const EPISODES_PER_PASS = 5;
export const CONFIDENCE_LEVELS = Object.freeze({ low: 0.3, medium: 0.6, high: 0.9 });
// Facts asked for per call; a short list keeps each reply well inside the token budget.
export const FACTS_PER_CALL = 5;
// Sources are cited by their number, which costs a token or two where a full URL costs dozens.
export const FACTS_SCHEMA = {
    type: 'object',
    properties: {
        facts: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    statement: { type: 'string' },
                    source: { type: 'integer' },
                    confidence: { type: 'string', enum: Object.keys(CONFIDENCE_LEVELS) },
                },
                required: ['statement', 'source', 'confidence'],
            },
            maxItems: FACTS_PER_CALL,
        },
    },
    required: ['facts'],
};
export const OVERVIEW_SCHEMA = {
    type: 'object',
    properties: {
        summary: { type: 'string' },
        relationships: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    subject: { type: 'string' },
                    relation: { type: 'string' },
                    object: { type: 'string' },
                    source: { type: 'integer' },
                },
                required: ['subject', 'relation', 'object', 'source'],
            },
            maxItems: 5,
        },
    },
    required: ['summary', 'relationships'],
};
export const SUMMARY_SCHEMA = {
    type: 'object',
    properties: { summary: { type: 'string' } },
    required: ['summary'],
};
export const MEMORY_SCHEMA = {
    type: 'object',
    properties: {
        memories: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    store: { type: 'string', enum: [...MEMORY_STORES] },
                    statement: { type: 'string' },
                    reason: { type: 'string', maxLength: 200 },
                },
                required: ['store', 'statement'],
            },
            maxItems: 8,
        },
        research_topics: { type: 'array', items: { type: 'string', maxLength: 100 }, maxItems: 3 },
    },
    required: ['memories', 'research_topics'],
};
// Thrown from a step, or from its token callback, when foreground work starts; the step's job goes back to pending.
export class BackgroundPaused extends Error {
    name = 'BackgroundPaused';
    constructor() {
        super('Paused for foreground work');
    }
}
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function collapseSpaces(text) {
    return text.split(/\s+/).filter(Boolean).join(' ');
}
function errorText(error) {
    return error instanceof Error ? error.message : String(error);
}
// Rethrow a pause so it reaches the step's caller, letting every other failure be handled where it happened.
export function rethrowPause(error) {
    if (error instanceof BackgroundPaused) {
        throw error;
    }
}
// Runs background model calls one at a time, giving way as soon as foreground work starts.
export class BackgroundModel {
    settings;
    onToken;
    shouldPause;
    modelLock;
    modelCache;
    maxTokens;
    modelSource;
    contextSize;
    llm;
    constructor(settings, onToken, shouldPause, llm, modelLock, modelCache, modelSource = null) {
        this.settings = settings;
        this.onToken = onToken;
        this.shouldPause = shouldPause;
        this.modelLock = modelLock;
        this.modelCache = modelCache;
        this.llm = llm;
        this.maxTokens = settings.background_max_tokens ?? MAX_TOKENS;
        this.modelSource = modelSource ?? backgroundModelSource(settings);
        this.contextSize = this.modelSource.contextSize;
    }
    static fromOptions(settings, options) {
        return new BackgroundModel(settings, options.onToken ?? null, options.shouldPause ?? null, options.llm ?? null, options.modelLock ?? null, options.modelCache ?? null, options.modelSource ?? null);
    }
    checkPause() {
        if (this.shouldPause !== null && this.shouldPause()) {
            throw new BackgroundPaused();
        }
    }
    async load() {
        if (this.llm === null) {
            this.llm = this.modelCache !== null
                ? await this.modelCache.get(this.modelSource)
                : await this.modelSource.load();
        }
        return this.llm;
    }
    // The lock is taken per call, so a foreground request waits for one call at most.
    async locked(work) {
        if (this.modelLock === null) {
            return work();
        }
        await this.modelLock.acquire();
        try {
            return await work();
        }
        finally {
            this.modelLock.release();
        }
    }
    async run(systemPrompt, userInput, jsonSchema = null) {
        const streamToken = (token) => {
            this.checkPause();
            this.onToken?.(token);
        };
        return this.locked(async () => {
            this.checkPause();
            return runStage(await this.load(), systemPrompt, userInput, {
                maxTokens: this.maxTokens,
                temperature: TEMPERATURE,
                onToken: this.onToken !== null || this.shouldPause !== null ? streamToken : undefined,
                jsonSchema,
            });
        });
    }
    // Render the input sections, trimmed so they fit beside the prompt and the reply.
    async fit(systemPrompt, sections, pinned = 1) {
        const countTokens = tokenCounter(await this.load());
        const budget = inputTokenBudget(this.contextSize, this.maxTokens, countTokens, systemPrompt);
        return renderSections(fitSectionsToTokens(sections, budget, countTokens, pinned));
    }
    async summarizePage(pageJson, topic) {
        return this.locked(async () => {
            this.checkPause();
            return summarizeWebPage(await this.load(), pageJson, topic, `Background research on: ${topic}`, this.maxTokens, TEMPERATURE, this.contextSize);
        });
    }
}
// Number every page summary and search snippet, returning the pages and the snippets apart.
export function numberSources(results, pageSummaries) {
    const pages = [...pageSummaries].map(([url, summary], index) => ({ number: index + 1, url, text: summary }));
    const snippets = results.filter(isObject).map((result, index) => ({
        number: pages.length + index + 1,
        url: String(result.url ?? ''),
        text: `${String(result.title ?? '')}: ${completeSentences(String(result.snippet ?? ''))}`,
    }));
    return [pages, snippets];
}
function endsCutOff(text) {
    return text.endsWith('...') || text.endsWith('…');
}
// Drop the cut-off sentence at the end of a search snippet, so it is not taken for a whole fact.
export function completeSentences(snippet) {
    const text = snippet.trim();
    if (!endsCutOff(text)) {
        return text;
    }
    const end = Math.max(...['. ', '! ', '? '].map((mark) => text.lastIndexOf(mark)));
    return end > 0 ? text.slice(0, end + 1) : text.replace(/[.… ]+$/, '');
}
function renderSources(sources) {
    return sources.map((source) => [`Source ${source.number} (${source.url})`, source.text]);
}
export function parseJson(reply) {
    try {
        return JSON.parse(reply);
    }
    catch {
        return undefined;
    }
}
// Read a facts reply, or return no facts when it is not the expected JSON.
export function parseFacts(reply, urls) {
    const data = parseJson(reply);
    if (!isObject(data)) {
        return [];
    }
    const facts = Array.isArray(data.facts) ? data.facts : [];
    return facts
        .filter((fact) => isObject(fact)
        && typeof fact.statement === 'string'
        && fact.statement.trim() !== ''
        && typeof fact.confidence === 'string'
        && Object.hasOwn(CONFIDENCE_LEVELS, fact.confidence))
        .map((fact) => [
        collapseSpaces(fact.statement),
        urls.get(fact.source) ?? null,
        CONFIDENCE_LEVELS[fact.confidence],
    ]);
}
// Read the overview reply; a reply that is not the expected JSON is kept as a plain summary.
export function parseOverview(reply, urls) {
    const data = parseJson(reply);
    if (!isObject(data)) {
        return { summary: reply, relationships: [] };
    }
    const relationships = [];
    const seen = new Set();
    const items = Array.isArray(data.relationships) ? data.relationships : [];
    for (const item of items) {
        if (!isObject(item) || !['subject', 'relation', 'object'].every((key) => typeof item[key] === 'string' && item[key].trim())) {
            continue;
        }
        const [subject, relation, target] = ['subject', 'relation', 'object'].map((key) => item[key].trim());
        // A small model often repeats one relationship once per source, which would use up the list.
        const key = JSON.stringify([subject, relation, target].map(casefold));
        if (!seen.has(key)) {
            seen.add(key);
            relationships.push([subject, relation, target, urls.get(item.source) ?? null]);
        }
    }
    return { summary: String(data.summary || '').trim(), relationships };
}
// Drop the summary's sentences that state a version, measurement or date no source contains.
export function groundedSummary(summary, sources) {
    const everything = sources.map((source) => source.text).join('\n');
    return summary
        .split(/(?<=[.!?])\s+/)
        .filter((sentence) => unsupportedValues(sentence, everything).length === 0)
        .join(' ');
}
// Keep only facts the sources bear out: one stating a value no source has is dropped, and one its cited source does not back is lowered to low confidence.
export function groundedFacts(facts, sources) {
    const texts = new Map();
    for (const source of sources) {
        texts.set(source.url, [...(texts.get(source.url) ?? []), source.text]);
    }
    const everything = sources.map((source) => source.text).join('\n');
    const grounded = [];
    for (const [statement, url, givenConfidence] of facts) {
        // A statement ending in an ellipsis was copied from a cut-off snippet and is not a whole fact.
        if (unsupportedValues(statement, everything).length > 0 || endsCutOff(statement.trimEnd())) {
            continue;
        }
        let confidence = givenConfidence;
        const cited = url ? (texts.get(url) ?? []).join('\n') : '';
        const terms = searchTerms(statement);
        if (!cited || unsupportedValues(statement, cited).length > 0 || (terms.length > 0 && !sharesHalfTheTerms(terms, cited))) {
            confidence = Math.min(confidence, CONFIDENCE_LEVELS.low);
        }
        grounded.push([statement, url, confidence]);
    }
    return grounded;
}
// Return a fetched page's text with its spacing evened out, for telling whether two addresses are one page.
export function pageText(pageJson) {
    const page = parseJson(pageJson);
    if (page === undefined) {
        return pageJson;
    }
    return isObject(page) && typeof page.text === 'string' ? collapseSpaces(page.text) : pageJson;
}
// Keep only the start of a long page, so summarizing it holds the model for a few calls at most.
export function shortenPage(pageJson, maxChars) {
    const page = JSON.parse(pageJson);
    if (isObject(page) && typeof page.text === 'string') {
        page.text = page.text.slice(0, maxChars);
    }
    return JSON.stringify(page);
}
export const FACTS_PROMPT = prompt('facts');
export const OVERVIEW_PROMPT = prompt('overview');
// Ask for facts one source group at a time, so each reply stays short.
async function extractFacts(model, topic, groups, urls, report) {
    const facts = [];
    for (const group of groups) {
        let reply;
        try {
            reply = await model.run(FACTS_PROMPT, await model.fit(FACTS_PROMPT, [['Research topic', topic], ...renderSources(group)]), FACTS_SCHEMA);
        }
        catch (error) {
            rethrowPause(error);
            // One group that fails should not lose the facts from the others.
            report(`Skipped facts from source(s) ${group.map((source) => String(source.number)).join(', ')}: ${errorText(error)}`);
            continue;
        }
        facts.push(...parseFacts(reply, urls));
    }
    return facts;
}
// Research the next queued topic, returning false when the queue is empty.
export async function researchOneTopic(settings, options = {}) {
    const store = new KnowledgeStore(settings.knowledge_db_path);
    const job = store.claimJob();
    if (job === null) {
        return false;
    }
    const report = options.onProgress ?? (() => { });
    const model = BackgroundModel.fromOptions(settings, options);
    const topic = job.name;
    try {
        model.checkPause();
        report(`Searching: ${topic}`);
        const toolbox = new Toolbox(settings.filesystem_root, { maxSearchResults: settings.max_search_results });
        const rawResults = await toolbox.call('web_search', { query: topic, max_results: settings.max_search_results });
        if (rawResults.startsWith('Tool error')) {
            const message = rawResults.startsWith('Tool error:') ? rawResults.slice('Tool error:'.length) : rawResults;
            throw new Error(`Web search failed: ${message.trim()}`);
        }
        let results;
        try {
            results = JSON.parse(rawResults);
        }
        catch {
            throw new Error('Web search returned output that is not a result list.');
        }
        if (!Array.isArray(results) || results.length === 0) {
            throw new Error('Web search returned no usable results.');
        }
        const pageSummaries = new Map();
        const pageTexts = new Set();
        for (const result of results) {
            if (pageSummaries.size >= BACKGROUND_PAGES_PER_TOPIC) {
                break;
            }
            const url = isObject(result) ? String(result.url ?? '') : '';
            if (!url) {
                continue;
            }
            model.checkPause();
            report(`Reading ${url}`);
            const page = await toolbox.call('web_fetch', { url });
            if (page.startsWith('Tool error')) {
                continue;
            }
            // The same page often comes back under a second address, such as one with a tracking query.
            const text = pageText(page);
            if (pageTexts.has(text)) {
                report(`Skipped ${url}, the same page as one already read`);
                continue;
            }
            pageTexts.add(text);
            try {
                pageSummaries.set(url, await model.summarizePage(shortenPage(page, model.contextSize * 2), topic));
            }
            catch (error) {
                rethrowPause(error);
                // One unreadable page should not lose the rest of the topic's research.
                report(`Could not summarize ${url}: ${errorText(error)}`);
                continue;
            }
        }
        report('Extracting facts');
        const [pages, snippets] = numberSources(results, pageSummaries);
        const allSources = [...pages, ...snippets];
        const urls = new Map(allSources.map((source) => [source.number, source.url]));
        const groups = [...pages.map((page) => [page]), ...(snippets.length > 0 ? [snippets] : [])];
        const facts = groundedFacts(await extractFacts(model, topic, groups, urls, report), allSources);
        report('Summarizing the topic');
        let overview;
        try {
            const reply = await model.run(OVERVIEW_PROMPT, await model.fit(OVERVIEW_PROMPT, [['Research topic', topic], ...renderSources(allSources)]), OVERVIEW_SCHEMA);
            overview = parseOverview(reply, urls);
            overview.summary = groundedSummary(overview.summary, allSources);
        }
        catch (error) {
            rethrowPause(error);
            report(`Skipped the topic summary: ${errorText(error)}`);
            overview = { summary: '', relationships: [] };
        }
        report('Saving evidence and facts');
        const stored = store.storeSearchResults(topic, results, { topic, summary: overview.summary });
        if (!stored) {
            throw new Error('Search results contained no valid HTTP source URLs.');
        }
        for (const [url, summary] of pageSummaries) {
            store.setSourceSummary(url, summary);
        }
        for (const [statement, sourceUrl, confidence] of facts) {
            store.addFact(topic, statement, sourceUrl, confidence);
        }
        for (const [subject, relation, target, sourceUrl] of overview.relationships) {
            try {
                store.addRelationship(subject, relation, target, sourceUrl);
            }
            catch {
                continue;
            }
        }
        store.finishJob(job.id);
        report(`Stored ${stored} source(s) and ${facts.length} fact(s) for ${topic}`);
        return true;
    }
    catch (error) {
        if (error instanceof BackgroundPaused) {
            store.deferJob(job.id);
            report('Paused for foreground work');
            return true;
        }
        const name = error instanceof Error ? error.name : 'Error';
        store.finishJob(job.id, `${name}: ${errorText(error)}`);
        report(`Research failed: ${errorText(error)}`);
        return true;
    }
}
export const PARENT_SUMMARY_PROMPT = prompt('parent-summary');
// Rewrite a grouping topic's summary from its children's summaries; a researched topic keeps its own.
export async function refreshParentSummary(store, model, parent) {
    const children = store.childSummaries(parent);
    if (children.length === 0 || store.isResearched(parent)) {
        return;
    }
    // The schema keeps the reply to the summary itself, so no tokens go on thinking out loud.
    let summary;
    try {
        const reply = await model.run(PARENT_SUMMARY_PROMPT, await model.fit(PARENT_SUMMARY_PROMPT, [['Subject', parent], ...children.map(([name, text]) => [`Subtopic: ${name}`, text])]), SUMMARY_SCHEMA);
        const data = JSON.parse(reply);
        if (!isObject(data)) {
            return;
        }
        summary = String(data.summary || '').trim();
    }
    catch (error) {
        rethrowPause(error);
        return;
    }
    if (summary) {
        store.setTopicSummary(parent, summary);
    }
}
// ============================================================================
// Learning from past requests
// ============================================================================
export const LEARNING_PROMPT = prompt('learning');
// A word boundary that counts every letter and digit as a word character, as Python's does.
const WORD_BOUNDARY = `(?:(?<=${WORD})(?!${WORD})|(?<!${WORD})(?=${WORD}))`;
// A path, URL, or host name: what a location memory must name exactly as the requests showed it.
const LOCATION = new RegExp(`(?:~|\\.{0,2})/[^\\s,;:'"()]+|https?://[^\\s,;'"()]+|${WORD_BOUNDARY}(?:${WORD}|-)+(?:\\.(?:${WORD}|-)+)+:\\p{Nd}+${WORD_BOUNDARY}`, 'gu');
// Words any software memory may use without the requests showing them.
const GENERIC_SOFTWARE_WORDS = new Set('installed running runs service services version program programs machine system uses used available'.split(' '));
// Says whether a location or software memory names only what the requests showed, since the model guesses paths and versions.
export function groundedMemory(store, statement, seen) {
    if (store === 'locations') {
        const locations = (statement.match(LOCATION) ?? []).map((location) => location.replace(/\.+$/, ''));
        return locations.length > 0 && locations.every((location) => seen.includes(location));
    }
    if (store === 'software') {
        const seenWords = new Set(words(casefold(seen), 2));
        const named = searchTerms(statement).filter((word) => !GENERIC_SOFTWARE_WORDS.has(word));
        return named.length > 0 && named.slice(0, 2).every((word) => seenWords.has(word));
    }
    return true;
}
// Reads recent unprocessed requests and remembers what they show, each lesson in its own store.
export async function learnFromEpisodes(settings, options = {}) {
    const store = new KnowledgeStore(settings.knowledge_db_path);
    const unprocessed = store.episodes({ unprocessedOnly: true, limit: EPISODES_PER_PASS });
    if (unprocessed.length === 0) {
        return false;
    }
    // One pass reads requests from one project folder, so a project memory it learns can be kept to that folder.
    const scope = unprocessed[0].scope;
    const episodes = unprocessed.filter((episode) => episode.scope === scope);
    const report = options.onProgress ?? (() => { });
    const model = BackgroundModel.fromOptions(settings, options);
    report(`Learning from ${episodes.length} past request(s)`);
    const seen = episodes.map((episode) => `Request: ${episode.prompt}\n${episode.checklist}`).join('\n\n');
    let reply;
    try {
        reply = await model.run(LEARNING_PROMPT, seen, MEMORY_SCHEMA);
    }
    catch (error) {
        if (error instanceof BackgroundPaused) {
            report('Paused for foreground work');
            return true;
        }
        report(`Learning failed: ${errorText(error)}`);
        // Marking them processed stops one bad batch from failing on every idle pass.
        for (const episode of episodes) {
            store.markEpisodeProcessed(episode.id);
        }
        return true;
    }
    const data = parseJson(reply);
    const memories = isObject(data) && Array.isArray(data.memories) ? data.memories : [];
    const topics = isObject(data) && Array.isArray(data.research_topics) ? data.research_topics : [];
    let learned = 0;
    for (const memory of memories) {
        if (!isObject(memory) || typeof memory.store !== 'string' || !MEMORY_STORES.includes(memory.store)) {
            continue;
        }
        const statement = String(memory.statement ?? '').trim();
        if (statement && groundedMemory(memory.store, statement, seen)) {
            store.addMemory(memory.store, statement, { reason: String(memory.reason || ''), scope });
            learned += 1;
        }
    }
    // Researching what the user works on ahead of time lets later requests answer from memory.
    let queued = 0;
    for (const given of topics) {
        const topic = collapseSpaces(String(given));
        if (topic && !store.hasFacts(topic)) {
            queueResearchTopic(store, topic, settings.background_max_pending_jobs);
            queued += 1;
        }
    }
    for (const episode of episodes) {
        store.markEpisodeProcessed(episode.id);
    }
    report(`Learned ${learned} thing(s) from past requests and queued ${queued} topic(s) for research`);
    return true;
}
// ============================================================================
// Indexing for search by meaning
// ============================================================================
// Facts and topics embedded per pass; a small batch keeps a waiting request from waiting long.
export const EMBEDDING_BATCH_SIZE = 8;
// Embed one batch of facts and topics that have no vector yet, returning false when none are left.
export async function indexKnowledge(settings, options = {}) {
    const embedder = getEmbedder(settings.embedding_model_path);
    if (embedder === null) {
        return false;
    }
    const store = new KnowledgeStore(settings.knowledge_db_path, embedder);
    if (store.embedder === null) {
        return false;
    }
    const items = store.itemsToEmbed(embedder.name, EMBEDDING_BATCH_SIZE);
    if (items.length === 0 || (options.shouldPause && options.shouldPause())) {
        return false;
    }
    const report = options.onProgress ?? (() => { });
    report(`Indexing ${items.length} fact(s) and topic(s) for search by meaning`);
    let vectors;
    try {
        vectors = await embedder.embedDocuments(items.map(([, , body]) => body));
    }
    catch (error) {
        // A model that cannot load leaves search lexical; the other background work still runs.
        report(`Indexing failed: ${errorText(error)}`);
        return false;
    }
    store.saveEmbeddings(embedder.name, items, vectors);
    return true;
}
