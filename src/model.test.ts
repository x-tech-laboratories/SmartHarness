import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import {
    backgroundModelSource,
    chatHistory,
    grammarSchema,
    isRepeating,
    loadModel,
    localModelSource,
    ModelCache,
    REPEAT_WINDOW_CHARS,
    runStage,
    type ChatCompletion,
    type ChatCompletionRequest,
    type ModelSource,
} from './model.js';
import { DEFAULT_SETTINGS } from './settings.js';

const STOP: ChatCompletion = { content: 'Done', tool_calls: [], finish_reason: 'stop' };

// A source whose model records being closed.
function fakeSource(name: string) {
    const close = vi.fn(async () => undefined);
    const model = { ...replying(STOP), close };
    const source: ModelSource = { key: name, label: name, contextSize: 2048, load: vi.fn(async () => model) };
    return { source, model, close };
}

function replying(completion: ChatCompletion, streamed: string[] = []) {
    const requests: ChatCompletionRequest[] = [];
    return {
        requests,
        createChatCompletion: async (request: ChatCompletionRequest) => {
            requests.push(request);
            for (const token of streamed) {
                request.on_token?.(token);
            }
            return completion;
        },
    };
}

// ============================================================================
// One call
// ============================================================================

describe('runStage', () => {
    it('streams tokens to the callback and returns the whole reply', async () => {
        const llm = replying({ content: 'First second', tool_calls: [], finish_reason: 'stop' }, ['First ', 'second']);
        const streamed: string[] = [];

        const result = await runStage(llm, 'System', 'Input', { onToken: (token) => streamed.push(token) });

        expect(result).toBe('First second');
        expect(streamed).toEqual(['First ', 'second']);
        expect(llm.requests[0].messages.map((message) => message.role)).toEqual(['system', 'user']);
    });

    it('passes a schema as the response format', async () => {
        const llm = replying({ content: '{}', tool_calls: [], finish_reason: 'stop' });
        const schema = { type: 'object', properties: {} };

        await runStage(llm, 'System', 'Input', { jsonSchema: schema });

        expect(llm.requests[0].response_format).toEqual({ type: 'json_object', schema });
    });

    it('keeps a cut-off reply’s complete sentences only when asked', async () => {
        const cutOff = replying({ content: 'WAL is faster. Readers do not block wri', tool_calls: [], finish_reason: 'length' });
        await expect(runStage(cutOff, 'System', 'Input')).rejects.toThrow('token limit');
        await expect(runStage(cutOff, 'System', 'Input', { keepCutOff: true })).resolves.toBe('WAL is faster.');

        const noSentence = replying({ content: 'Readers do not block wri', tool_calls: [], finish_reason: 'length' });
        await expect(runStage(noSentence, 'System', 'Input', { keepCutOff: true })).rejects.toThrow('token limit');
    });

    it('refuses a reply that was stopped for repeating itself', async () => {
        const looping = replying({ content: "'One' rhymes with 'one'.", tool_calls: [], finish_reason: 'repetition' });

        await expect(runStage(looping, 'System', 'Input', { keepCutOff: true })).rejects.toThrow('kept repeating itself');
    });

    it('refuses an empty reply', async () => {
        const llm = replying({ content: '  ', tool_calls: [], finish_reason: 'stop' });

        await expect(runStage(llm, 'System', 'Input')).rejects.toThrow('empty completion');
    });
});

// ============================================================================
// Conversions
// ============================================================================

describe('chatHistory', () => {
    it('pairs each tool call with the result that answered it', () => {
        const history = chatHistory([
            { role: 'system', content: 'S' },
            { role: 'user', content: 'U' },
            { role: 'assistant', content: null, tool_calls: [{ id: 'a', type: 'function', function: { name: 'read_file', arguments: '{"path":"x"}' } }] },
            { role: 'tool', tool_call_id: 'a', content: 'contents' },
        ]);

        expect(history).toEqual([
            { type: 'system', text: 'S' },
            { type: 'user', text: 'U' },
            { type: 'model', response: [{ type: 'functionCall', name: 'read_file', params: { path: 'x' }, result: 'contents' }] },
        ]);
    });

    it('keeps a reply with its text, reads broken arguments as none, and gives an unmatched result to the user', () => {
        const history = chatHistory([
            { role: 'system', content: null },
            { role: 'user', content: null },
            { role: 'assistant', content: 'Looking.', tool_calls: [{ id: 'b', type: 'function', function: { name: 'search', arguments: '{not json' } }] },
            { role: 'tool', tool_call_id: 'missing', content: 'stray' },
            { role: 'tool', content: null },
        ]);

        expect(history).toEqual([
            { type: 'system', text: '' },
            { type: 'user', text: '' },
            { type: 'model', response: ['Looking.', { type: 'functionCall', name: 'search', params: {}, result: '' }] },
            { type: 'user', text: 'stray' },
            { type: 'user', text: '' },
        ]);
    });
});

describe('grammarSchema', () => {
    it('drops keywords the grammar cannot express and requires every listed property', () => {
        const schema = {
            type: 'object',
            properties: { count: { type: 'integer', minimum: 0, maximum: 5 }, names: { type: 'array', items: { type: 'string', pattern: 'x' }, maxItems: 3 } },
        };

        expect(grammarSchema(schema)).toEqual({
            type: 'object',
            properties: { count: { type: 'integer' }, names: { type: 'array', items: { type: 'string' }, maxItems: 3 } },
            required: ['count', 'names'],
        });
    });

    it('walks lists and alternatives, keeps a given required list, and leaves plain values alone', () => {
        const schema = {
            anyOf: [{ type: 'string', pattern: 'x' }, { type: 'null' }],
            prefixItems: [{ type: 'number', minimum: 1 }],
            oneOf: [{ type: 'object', properties: { a: { type: 'string' } }, required: [] }],
            additionalProperties: { type: 'boolean', default: true },
        };

        expect(grammarSchema(schema)).toEqual({
            anyOf: [{ type: 'string' }, { type: 'null' }],
            prefixItems: [{ type: 'number' }],
            oneOf: [{ type: 'object', properties: { a: { type: 'string' } }, required: [] }],
            additionalProperties: { type: 'boolean' },
        });
        expect(grammarSchema('text')).toBe('text');
        expect(grammarSchema(null)).toBe(null);
    });
});

// ============================================================================
// Model cache
// ============================================================================

describe('ModelCache', () => {
    it('reports nothing loaded until a model is', async () => {
        const cache = new ModelCache();

        expect(cache.has(localModelSource('model.gguf', 4096, -1))).toBe(false);
        await expect(cache.unload()).resolves.toBe(false);
    });

    it('keeps a model for the same source and swaps it when the source changes', async () => {
        const cache = new ModelCache();
        const first = fakeSource('first');
        const second = fakeSource('second');

        const loaded = await cache.get(first.source);
        await cache.get(first.source);
        expect(first.source.load).toHaveBeenCalledOnce();
        expect(cache.has(first.source)).toBe(true);

        await cache.get(second.source);
        expect(first.close).toHaveBeenCalledOnce();
        expect(cache.has(first.source)).toBe(false);
        expect(cache.has(second.source)).toBe(true);
        expect(loaded).toBe(first.model);
    });

    it('forgets a source whose load failed, so the next call tries again', async () => {
        const cache = new ModelCache();
        const broken: ModelSource = { key: 'broken', label: 'broken', contextSize: 1, load: vi.fn(async () => Promise.reject(new Error('no file'))) };

        await expect(cache.get(broken)).rejects.toThrow('no file');

        expect(cache.has(broken)).toBe(false);
        await expect(cache.unload()).resolves.toBe(false);
    });

    it('unloads a model that has nothing to close', async () => {
        const cache = new ModelCache();
        const source: ModelSource = { key: 'plain', label: 'plain', contextSize: 1, load: async () => replying(STOP) };

        await cache.get(source);

        await expect(cache.unload()).resolves.toBe(true);
    });
});

describe('loadModel', () => {
    it('uses a model it is given without loading', async () => {
        const given = replying(STOP);
        const { source } = fakeSource('unused');

        expect(await loadModel(given, source, null, () => undefined)).toBe(given);
        expect(source.load).not.toHaveBeenCalled();
    });

    it('loads through the cache, reporting only a load that takes time', async () => {
        const cache = new ModelCache();
        const { source, model } = fakeSource('cached');
        const progress: string[] = [];

        expect(await loadModel(null, source, cache, (message) => progress.push(message))).toBe(model);
        expect(await loadModel(null, source, cache, (message) => progress.push(message))).toBe(model);

        expect(progress).toEqual(['Loading model']);
    });

    it('loads the source directly without a cache, naming it on the terminal', async () => {
        const { source, model } = fakeSource('direct');
        const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

        expect(await loadModel(null, source, null)).toBe(model);

        expect(log).toHaveBeenCalledWith('Loading model from direct...');
        log.mockRestore();
    });
});

describe('model sources', () => {
    it('keys a local model by its path, context size and GPU layers', () => {
        const source = localModelSource('model.gguf', 4096, -1);

        expect(source.label).toBe('model.gguf');
        expect(source.contextSize).toBe(4096);
        expect(source.key).not.toBe(localModelSource('model.gguf', 4096, 0).key);
        expect(source.key).toBe(localModelSource('model.gguf', 4096, -1).key);
    });

    it('gives background work the background model when one is set, and the main one otherwise', () => {
        const settings = { ...DEFAULT_SETTINGS };

        expect(backgroundModelSource(settings).key).toBe(localModelSource(settings.model_path, settings.context_size, settings.gpu_layers).key);
        expect(backgroundModelSource({ ...settings, background_model_path: 'small.gguf', background_gpu_layers: 0 }).key).toBe(
            localModelSource('small.gguf', settings.context_size, 0).key,
        );
    });
});

// ============================================================================
// Repetition
// ============================================================================

const TENS = ['Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy'];
const ONES = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

const PROSE =
    'The daemon keeps one model loaded and hands it to each run in turn, so a second request waits rather than ' +
    'loading another copy. Background research pauses while a request is active and picks up again once the window ' +
    'is idle. Settings changed in the Options page apply to the next run; the model is reloaded only when its path, ' +
    'context size or GPU layers change. Each task in the tree is decided, written and checked, and a task that fails ' +
    'its check is revised once before it is split into smaller parts. Results from earlier tasks are condensed when ' +
    'they no longer fit, keeping the newest ones whole. The knowledge store records every page a search reads, with ' +
    'the facts drawn from it and the date it was fetched, so a later question about the same topic can be answered ' +
    'without going back to the web. Pages older than the refresh interval are fetched again when a run needs them. ' +
    'Mail is read from the folders and accounts listed in the settings, and replies are drafted but never sent. ' +
    'When a run is cancelled, the tree is saved as it stands, and the Resume button carries on from the task that ' +
    'was in progress. Connected tools are offered only to tasks that act, and each call is shown for approval first.';

describe('isRepeating', () => {
    it('spots a reply listing the same sentence with only the number changed', () => {
        const looping = TENS.flatMap((tens) => ONES.map((ones) => `'${tens}-${ones}' rhymes with '${tens.toLowerCase()}-${ones}'. `)).join('');

        expect(isRepeating(looping)).toBe(true);
    });

    it('leaves prose, short replies and repetitive data alone', () => {
        const catalogue = readFileSync(new URL('../evals/fake_catalogue.json', import.meta.url), 'utf-8');

        expect(PROSE.length).toBeGreaterThanOrEqual(REPEAT_WINDOW_CHARS);
        expect(isRepeating(PROSE)).toBe(false);
        expect(isRepeating('ha '.repeat(100))).toBe(false);
        for (let end = REPEAT_WINDOW_CHARS; end <= catalogue.length; end += 200) {
            expect(isRepeating(catalogue.slice(0, end))).toBe(false);
        }
    });
});
