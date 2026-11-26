import type { ChatHistoryItem, Llama, LlamaModel } from 'node-llama-cpp';
import { type Settings } from './settings.js';
export declare const TEXT_TOOL_CALL_OPENINGS: readonly string[];
export type ToolCall = {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
};
export type ChatMessage = {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string | null;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    name?: string;
};
export type ToolDefinition = {
    type: 'function';
    function: {
        name: string;
        description?: string;
        parameters?: Record<string, unknown>;
    };
};
export type ChatCompletionRequest = {
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
    response_format?: {
        type: 'json_object';
        schema?: Record<string, unknown>;
    };
    tools?: ToolDefinition[];
    tool_choice?: 'auto' | 'none';
    on_token?: (token: string) => void;
    signal?: AbortSignal;
};
export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'repetition';
export declare const TOKEN_LIMIT_MESSAGE = "A model call reached the token limit; raise max_tokens (background_max_tokens for background research) or context_size, or use Auto size in Options.";
export declare const REPETITION_MESSAGE = "A model call kept repeating itself, so it was stopped.";
export type ChatCompletion = {
    content: string;
    tool_calls: ToolCall[];
    finish_reason: FinishReason;
};
export type ChatModel = {
    createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletion>;
    tokenize?(text: string): number[];
    close?(): Promise<void>;
};
export declare function llamaBackend(onCpuOnly: boolean): Promise<Llama>;
export declare function loadGgufModel(modelPath: string, gpuLayers: number, onWait?: (message: string) => void): Promise<{
    llama: Llama;
    model: LlamaModel;
    release: () => void;
}>;
export declare class LocalModel implements ChatModel {
    private readonly llama;
    private readonly model;
    private readonly context;
    private readonly sequence;
    private readonly release;
    private queue;
    private readonly grammars;
    private chatWrapper;
    private constructor();
    static load(modelPath: string, contextSize: number, gpuLayers: number, onWait?: (message: string) => void): Promise<LocalModel>;
    tokenize(text: string): number[];
    createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletion>;
    close(): Promise<void>;
    private complete;
    private grammarFor;
}
export declare function chatHistory(messages: ChatMessage[]): ChatHistoryItem[];
export declare function grammarSchema(schema: unknown): unknown;
export type ModelSource = {
    key: string;
    label: string;
    contextSize: number;
    load(onWait?: (message: string) => void): Promise<ChatModel>;
};
export declare function localModelSource(modelPath: string, contextSize: number, gpuLayers: number): ModelSource;
export declare function backgroundModelSource(settings: Settings): ModelSource;
export declare class ModelCache {
    private key;
    private model;
    has(source: ModelSource): boolean;
    get(source: ModelSource, onWait?: (message: string) => void): Promise<ChatModel>;
    unload(): Promise<boolean>;
}
export declare const REPEAT_WINDOW_CHARS = 1200;
export declare const REPEAT_CHECK_CHARS = 200;
export declare const REPEAT_RATIO = 0.2;
export declare function isRepeating(text: string): boolean;
export type StageOptions = {
    maxTokens?: number;
    temperature?: number;
    onToken?: (token: string) => void;
    jsonSchema?: Record<string, unknown> | null;
    keepCutOff?: boolean;
    signal?: AbortSignal;
};
export declare function runStage(llm: ChatModel, systemPrompt: string, userInput: string, options?: StageOptions): Promise<string>;
export declare function loadModel(llm: ChatModel | null | undefined, source: ModelSource, modelCache: ModelCache | null, progressCallback?: (message: string) => void): Promise<ChatModel>;
