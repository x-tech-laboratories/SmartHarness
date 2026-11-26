import { deflateRawSync } from 'node:zlib';
import { GPU_LOCK } from './gpuLock.js';
import { MAX_TOKENS, TEMPERATURE, backgroundModelKey } from './settings.js';
// How a tool call written as text begins, in Qwen's XML form and the form of Spark models.
export const TEXT_TOOL_CALL_OPENINGS = ['<tool_call>', '<function='];
export const TOKEN_LIMIT_MESSAGE = 'A model call reached the token limit; raise max_tokens (background_max_tokens for background research) or context_size, or use Auto size in Options.';
export const REPETITION_MESSAGE = 'A model call kept repeating itself, so it was stopped.';
// Phi-4-mini's template has a <|tool|> block, and the model writes calls in <|tool_call|>; it drops the "||" of node-llama-cpp's generic "||call:" syntax.
const PHI_TOOL_BLOCK = "'<|tool|>'";
const PHI_FUNCTION_CALLS = {
    call: '<|tool_call|>[{"name": "{{functionName}}", "arguments": {{functionParams}}}]<|/tool_call|>',
    result: '\n<|tool_response|>{{functionCallResult}}\n',
};
// ============================================================================
// Backends
// ============================================================================
let gpuBackend = null;
let cpuBackend = null;
// A CPU-only model gets its own backend, so its context cache and prompt batches stay off the GPU.
export async function llamaBackend(onCpuOnly) {
    const { getLlama, LlamaLogLevel } = await import('node-llama-cpp');
    // Only llama.cpp's errors reach the terminal, so its load messages never mix into a reply.
    const logLevel = LlamaLogLevel.error;
    if (onCpuOnly) {
        cpuBackend ??= getLlama({ gpu: false, logLevel });
        return cpuBackend;
    }
    gpuBackend ??= getLlama({ logLevel });
    return gpuBackend;
}
// Load a GGUF file; a model with layers on the GPU holds the shared GPU lock until it is disposed.
export async function loadGgufModel(modelPath, gpuLayers, onWait) {
    const onCpuOnly = gpuLayers === 0;
    if (!onCpuOnly) {
        await GPU_LOCK.acquire(onWait);
    }
    try {
        const llama = await llamaBackend(onCpuOnly);
        const model = await llama.loadModel({
            modelPath,
            gpuLayers: onCpuOnly ? 0 : gpuLayers < 0 ? 'max' : gpuLayers,
            ignoreMemorySafetyChecks: true,
        });
        let released = false;
        const release = () => {
            if (!released && !onCpuOnly) {
                GPU_LOCK.release();
            }
            released = true;
        };
        return { llama, model, release };
    }
    catch (error) {
        if (!onCpuOnly) {
            GPU_LOCK.release();
        }
        throw error;
    }
}
// ============================================================================
// Local model
// ============================================================================
export class LocalModel {
    llama;
    model;
    context;
    sequence;
    release;
    queue = Promise.resolve();
    grammars = new Map();
    chatWrapper = null;
    constructor(llama, model, context, sequence, release) {
        this.llama = llama;
        this.model = model;
        this.context = context;
        this.sequence = sequence;
        this.release = release;
    }
    static async load(modelPath, contextSize, gpuLayers, onWait) {
        const { llama, model, release } = await loadGgufModel(modelPath, gpuLayers, onWait);
        try {
            // Auto size fits the context to the card, so the library's own, stricter estimate is skipped.
            const context = await model.createContext({ contextSize, ignoreMemorySafetyChecks: true });
            return new LocalModel(llama, model, context, context.getSequence(), release);
        }
        catch (error) {
            await model.dispose();
            release();
            throw error;
        }
    }
    tokenize(text) {
        return Array.from(this.model.tokenize(text, false));
    }
    async createChatCompletion(request) {
        // One context sequence serves every call, so calls take turns.
        const turn = this.queue.then(() => this.complete(request));
        this.queue = turn.catch(() => undefined);
        return turn;
    }
    async close() {
        await this.queue;
        await this.context.dispose();
        await this.model.dispose();
        this.release();
    }
    async complete(request) {
        const { LlamaChat, resolveChatWrapper } = await import('node-llama-cpp');
        // Every call asks for a direct reply, so a model that can think out loud is told not to.
        const template = this.model.fileInfo.metadata?.tokenizer?.chat_template;
        const phiTools = typeof template === 'string' && template.includes(PHI_TOOL_BLOCK);
        this.chatWrapper ??= resolveChatWrapper(this.model, {
            customWrapperSettings: {
                qwen: { thoughts: 'discourage' },
                ...(phiTools ? { jinjaTemplate: { functionCallMessageTemplate: PHI_FUNCTION_CALLS } } : {}),
            },
        });
        const chat = new LlamaChat({ contextSequence: this.sequence, chatWrapper: this.chatWrapper, autoDisposeSequence: false });
        const history = chatHistory(request.messages);
        const toolsOffered = (request.tools?.length ?? 0) > 0 && request.tool_choice !== 'none';
        const grammar = request.response_format?.schema ? await this.grammarFor(request.response_format.schema) : undefined;
        // A token callback that throws stops the call, which is how a waiting run takes the model back.
        const abort = new AbortController();
        const stopFromOutside = () => abort.abort(request.signal?.reason);
        request.signal?.addEventListener('abort', stopFromOutside, { once: true });
        let callbackError = null;
        let generated = '';
        let checkedLength = 0;
        let repeating = false;
        const onTextChunk = (text) => {
            if (callbackError !== null || repeating) {
                return;
            }
            generated += text;
            if (generated.length - checkedLength >= REPEAT_CHECK_CHARS) {
                checkedLength = generated.length;
                if (isRepeating(generated)) {
                    repeating = true;
                    abort.abort(new Error(REPETITION_MESSAGE));
                    return;
                }
            }
            if (!request.on_token) {
                return;
            }
            try {
                request.on_token(text);
            }
            catch (error) {
                callbackError = error;
                abort.abort(error);
            }
        };
        try {
            const response = await chat.generateResponse([...history, { type: 'model', response: [] }], {
                maxTokens: request.max_tokens ?? MAX_TOKENS,
                temperature: request.temperature ?? TEMPERATURE,
                grammar: grammar,
                functions: toolsOffered ? functionDefinitions(request.tools) : undefined,
                // With no tools offered, a call the model starts writing as text stops the reply at its opening tag.
                customStopTriggers: toolsOffered || grammar ? undefined : TEXT_TOOL_CALL_OPENINGS,
                onTextChunk,
                signal: abort.signal,
            });
            const toolCalls = (response.functionCalls ?? []).map((call, index) => ({
                id: `call_${index}`,
                type: 'function',
                function: { name: call.functionName, arguments: JSON.stringify(call.params ?? {}) },
            }));
            const stopReason = response.metadata.stopReason;
            // The opening tag is kept so the checks see that the model wanted a tool it did not have.
            const content = stopReason === 'customStopTrigger' ? response.response + TEXT_TOOL_CALL_OPENINGS[0] : response.response;
            return {
                content,
                tool_calls: toolCalls,
                finish_reason: toolCalls.length > 0 ? 'tool_calls' : stopReason === 'maxTokens' ? 'length' : 'stop',
            };
        }
        catch (error) {
            if (repeating && callbackError === null && !request.signal?.aborted) {
                return { content: generated, tool_calls: [], finish_reason: 'repetition' };
            }
            throw callbackError ?? error;
        }
        finally {
            request.signal?.removeEventListener('abort', stopFromOutside);
            chat.dispose({ disposeSequence: false });
        }
    }
    async grammarFor(schema) {
        const key = JSON.stringify(schema);
        let grammar = this.grammars.get(key);
        if (!grammar) {
            grammar = this.llama.createGrammarForJsonSchema(grammarSchema(schema));
            this.grammars.set(key, grammar);
        }
        return grammar;
    }
}
// ============================================================================
// Conversions
// ============================================================================
// Turn chat messages into node-llama-cpp's history, pairing each tool call with the result that answered it.
export function chatHistory(messages) {
    const history = [];
    const pendingCalls = new Map();
    for (const message of messages) {
        if (message.role === 'system') {
            history.push({ type: 'system', text: message.content ?? '' });
        }
        else if (message.role === 'user') {
            history.push({ type: 'user', text: message.content ?? '' });
        }
        else if (message.role === 'assistant') {
            const response = [];
            if (message.content) {
                response.push(message.content);
            }
            for (const call of message.tool_calls ?? []) {
                const functionCall = {
                    type: 'functionCall',
                    name: call.function.name,
                    params: parseArguments(call.function.arguments),
                    result: '',
                };
                pendingCalls.set(call.id, functionCall);
                response.push(functionCall);
            }
            history.push({ type: 'model', response });
        }
        else if (message.role === 'tool') {
            const call = message.tool_call_id ? pendingCalls.get(message.tool_call_id) : undefined;
            if (call) {
                call.result = message.content ?? '';
            }
            else {
                history.push({ type: 'user', text: message.content ?? '' });
            }
        }
    }
    return history;
}
function functionDefinitions(tools) {
    const functions = {};
    for (const tool of tools) {
        functions[tool.function.name] = {
            description: tool.function.description,
            params: tool.function.parameters ? grammarSchema(tool.function.parameters) : undefined,
        };
    }
    return functions;
}
function parseArguments(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return {};
    }
}
const GRAMMAR_KEYWORDS = new Set([
    'type',
    'properties',
    'required',
    'items',
    'enum',
    'const',
    'oneOf',
    'anyOf',
    'description',
    'minItems',
    'maxItems',
    'minLength',
    'maxLength',
    'additionalProperties',
    'format',
    'prefixItems',
]);
// Keep only the schema keywords node-llama-cpp turns into grammar, and make every listed property required.
export function grammarSchema(schema) {
    if (Array.isArray(schema)) {
        return schema.map(grammarSchema);
    }
    if (schema === null || typeof schema !== 'object') {
        return schema;
    }
    const source = schema;
    const result = {};
    for (const [key, value] of Object.entries(source)) {
        if (!GRAMMAR_KEYWORDS.has(key)) {
            continue;
        }
        if (key === 'properties' && value && typeof value === 'object') {
            result.properties = Object.fromEntries(Object.entries(value).map(([name, child]) => [name, grammarSchema(child)]));
        }
        else if (key === 'items' || key === 'additionalProperties' || key === 'oneOf' || key === 'anyOf' || key === 'prefixItems') {
            result[key] = grammarSchema(value);
        }
        else {
            result[key] = value;
        }
    }
    if (result.type === 'object' && result.properties && result.required === undefined) {
        result.required = Object.keys(result.properties);
    }
    return result;
}
export function localModelSource(modelPath, contextSize, gpuLayers) {
    return {
        key: JSON.stringify(['local', modelPath, contextSize, gpuLayers]),
        label: modelPath,
        contextSize,
        load: (onWait) => LocalModel.load(modelPath, contextSize, gpuLayers, onWait),
    };
}
// The model background work loads when the caller gives it none.
export function backgroundModelSource(settings) {
    return localModelSource(...backgroundModelKey(settings));
}
// ============================================================================
// Model cache
// ============================================================================
// Keep one loaded model and reload it only when its source changes.
export class ModelCache {
    key = null;
    model = null;
    has(source) {
        return this.model !== null && this.key === source.key;
    }
    async get(source, onWait) {
        if (!this.has(source)) {
            // Drop the old model first so two never sit in memory together.
            await this.unload();
            const loading = source.load(onWait);
            this.model = loading;
            this.key = source.key;
            loading.catch(() => {
                if (this.model === loading) {
                    this.model = null;
                    this.key = null;
                }
            });
        }
        return this.model;
    }
    // Drop the loaded model to give its memory back, returning whether one was loaded.
    async unload() {
        const loading = this.model;
        this.model = null;
        this.key = null;
        if (!loading) {
            return false;
        }
        try {
            await (await loading).close?.();
        }
        catch {
            // A model that failed to load holds nothing to free.
        }
        return true;
    }
}
// ============================================================================
// Repetition
// ============================================================================
// Looping text compresses far better than prose, code or data does, so a reply is checked by how small its tail packs.
export const REPEAT_WINDOW_CHARS = 1200;
export const REPEAT_CHECK_CHARS = 200;
export const REPEAT_RATIO = 0.2;
export function isRepeating(text) {
    if (text.length < REPEAT_WINDOW_CHARS) {
        return false;
    }
    const tail = Buffer.from(text.slice(-REPEAT_WINDOW_CHARS), 'utf-8');
    return deflateRawSync(tail).length / tail.length < REPEAT_RATIO;
}
// Run one model call; with keepCutOff, a prose reply that hits the token limit keeps its complete sentences.
export async function runStage(llm, systemPrompt, userInput, options = {}) {
    const request = {
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userInput },
        ],
        temperature: options.temperature ?? TEMPERATURE,
        max_tokens: options.maxTokens ?? MAX_TOKENS,
        on_token: options.onToken,
        signal: options.signal,
    };
    if (options.jsonSchema) {
        // The schema becomes a grammar, so the reply is always valid JSON of this shape.
        request.response_format = { type: 'json_object', schema: options.jsonSchema };
    }
    const completion = await llm.createChatCompletion(request);
    const content = completion.content;
    if (completion.finish_reason === 'length' && options.keepCutOff) {
        const end = Math.max(...['. ', '.\n', '! ', '? '].map((mark) => content.lastIndexOf(mark)));
        if (end > 0) {
            return content.slice(0, end + 1).trim();
        }
    }
    if (completion.finish_reason === 'length') {
        throw new Error(TOKEN_LIMIT_MESSAGE);
    }
    if (completion.finish_reason === 'repetition') {
        throw new Error(REPETITION_MESSAGE);
    }
    if (!content.trim()) {
        throw new Error('The model returned an empty completion.');
    }
    return content.trim();
}
// Return the given model, or load one, reporting the load only when it takes time.
export async function loadModel(llm, source, modelCache, progressCallback) {
    if (llm) {
        return llm;
    }
    const report = progressCallback ?? ((message) => console.log(message));
    if (modelCache === null || !modelCache.has(source)) {
        report(progressCallback ? 'Loading model' : `Loading model from ${source.label}...`);
    }
    if (modelCache) {
        return modelCache.get(source, report);
    }
    return source.load(report);
}
