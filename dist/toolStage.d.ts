import { type ChatModel, type ToolCall, type ToolDefinition } from './model.js';
import type { McpServerSettings } from './settings.js';
export declare const MAX_TOOL_HISTORY_CHARS = 8000;
export declare const CONNECTED_TOOL_PREFIX = "mcp__";
export declare const REPEATED_CALL_NOTE = "Same call as before; this result is already above. Answer from it now.";
export declare const ANSWER_NOW_CALL_NOTE = "The model tried to call a tool after being told to answer; the call was not run.";
export type ToolboxLike = {
    toolDefinitions: ToolDefinition[];
    call(name: string, argumentsGiven: unknown): Promise<string> | string;
};
export type ToolCallRecord = {
    name: string;
    arguments: string;
    valid: boolean;
    error: boolean;
};
export type PageSummarizer = (pageJson: string, focus: string, requestContext: string) => Promise<string> | string;
export type ToolStageOptions = {
    mcpServers?: McpServerSettings[] | null;
    onToken?: ((token: string) => void) | null;
    allowedTools?: Set<string> | null;
    pageSummarizer?: PageSummarizer | null;
    blockedTools?: Set<string> | null;
    contextSize?: number | null;
    signal?: AbortSignal;
    onToolCall?: ((call: ToolCallRecord) => void) | null;
    onToolResult?: ((name: string, rawArguments: string, result: string) => void) | null;
    onStageEnd?: ((summary: ToolStageSummary) => void) | null;
};
export type ToolStageSummary = {
    toolCalls: number;
    limitReached: boolean;
    resultsCut: boolean;
};
export declare function pythonJsonLength(value: unknown): number;
export declare function textToolCalls(content: unknown, toolDefinitions: ToolDefinition[]): ToolCall[];
export declare function callIsValid(name: string, rawArguments: string, toolDefinitions: ToolDefinition[]): boolean;
export declare function runToolStage(llm: ChatModel, systemPrompt: string, userInput: string, toolbox: ToolboxLike, maxTokens: number, temperature: number, maxToolCalls: number, options?: ToolStageOptions): Promise<string>;
export declare const MODEL_WORDS_LABEL = "The model's own words after the tool calls:";
