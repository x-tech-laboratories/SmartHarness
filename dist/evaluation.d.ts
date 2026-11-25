#!/usr/bin/env node
import { type TextEmbedder } from './embeddings.js';
import { type ChatCompletion, type ChatCompletionRequest, type ChatModel } from './model.js';
import { type McpServerSettings, type Settings } from './settings.js';
import { type AgentToolCall, type Delegation } from './taskTree.js';
export declare const EVALS_DIRECTORY: string;
export declare const DEFAULT_TASKS_PATH: string;
export declare const RECALL_TASKS_PATH: string;
export declare const DEFAULT_SEED_PATH: string;
export declare const AGENTS_TASKS_PATH: string;
export declare const AGENT_FILES_DIRECTORY: string;
export declare const FAKE_SERVER_PATH: string;
export declare const FAKE_SERVERS: readonly string[];
export declare const RUNNER_CHOICES: readonly ['bare', 'tree', 'agents'];
export declare const STORE_RUNNERS: readonly string[];
export declare const SEEDED_SUFFIX = "+store";
export declare const BARE_SYSTEM_PROMPT: string;
export declare const BARE_FILES_NOTE: string;
export declare const EVAL_MODES: readonly ['auto', 'answer', 'draft', 'execute'];
export declare const ANSWER_CHECK_TYPES: readonly ['contains', 'contains_any', 'not_contains', 'regex', 'not_regex', 'max_words', 'min_words'];
export declare const FILE_CHECK_TYPES: readonly ['tests_pass', 'file_contains', 'file_unchanged'];
export declare const CHECK_TYPES: readonly string[];
export declare const TEST_TIMEOUT_SECONDS = 120;
export type Check = {
    type: string;
    value?: unknown;
    values?: unknown;
    pattern?: unknown;
    path?: unknown;
};
export declare function pythonRepr(text: string): string;
export declare function translatePattern(pattern: string): string;
export declare function compilePattern(pattern: string): RegExp;
export declare function pythonJson(value: unknown, floatKeys: ReadonlySet<string>, indent?: string, key?: string): string;
export declare class EvalTask {
    id: string;
    prompt: string;
    checks: Check[];
    mode: string;
    files: Record<string, string>;
    servers: string[];
    expect_servers: string[];
    constructor(fields: {
        id: string;
        prompt: string;
        checks: Check[];
        mode?: string;
        files?: Record<string, string>;
        servers?: string[];
        expect_servers?: string[];
    });
}
export declare function loadTasks(tasksPath: string): EvalTask[];
export declare function validateCheck(taskId: string, check: unknown): asserts check is Check;
export declare function buildSeedStore(seedPath: string, databasePath: string, embedder?: TextEmbedder | null): Promise<void>;
export declare function checkPasses(answer: string, check: Check, task?: EvalTask | null, workspace?: string | null): Promise<boolean>;
export declare function runTests(workspace: string): Promise<boolean>;
export declare function describeCheck(check: Check): string;
export type RecordedToolCall = {
    name: string;
    arguments: string;
};
export declare class CountingModel implements ChatModel {
    private readonly llm;
    private readonly onToolCall;
    calls: number;
    completionTokens: number;
    toolCalls: RecordedToolCall[];
    constructor(llm: ChatModel, onToolCall?: ((call: RecordedToolCall) => void) | null);
    createChatCompletion(request: ChatCompletionRequest): Promise<ChatCompletion>;
    tokenize(text: string): number[];
    close(): Promise<void>;
}
export declare class RunResult {
    task_id: string;
    runner: string;
    answer: string;
    error: string;
    checks_passed: number;
    checks_total: number;
    failed_checks: string[];
    seconds: number;
    model_calls: number;
    completion_tokens: number;
    tool_calls: RecordedToolCall[];
    agents: Delegation[];
    tool_sequence: AgentToolCall[];
    tool_choice: boolean | null;
    attempt: number;
    constructor(fields: Partial<RunResult> & {
        task_id: string;
        runner: string;
    });
    get passed(): boolean;
    toJson(): Record<string, unknown>;
}
export declare function runTask(task: EvalTask, runner: string, llm: ChatModel, settings: Settings, seedStore?: string | null, attempt?: number, onEvent?: ((line: string) => void) | null): Promise<RunResult>;
export declare function toolChoice(task: EvalTask, calls: AgentToolCall[]): boolean | null;
export declare function writeFiles(workspace: string, files: Record<string, string>): void;
export declare function barePrompt(task: EvalTask): string;
export declare function fileBlocks(answer: string): Record<string, string>;
export declare function copyStore(seedStore: string, destination: string): Promise<void>;
export declare function fakeServers(names: string[]): McpServerSettings[];
export declare function runnerLabels(runners: string[], seedStore: string | null): string[];
export declare function runEval(tasks: EvalTask[], runners: string[], llm: ChatModel, settings: Settings, options?: {
    onResult?: (result: RunResult) => void;
    onEvent?: (line: string) => void;
    seedStore?: string | null;
    repeat?: number;
}): Promise<RunResult[]>;
export type RunnerSummary = {
    tasks: number;
    tasks_passed: number;
    pass_rate: number;
    round_passes: number[];
    distinct_tasks: number;
    tasks_passed_every_round: number;
    pass_every_round_rate: number;
    tool_calls: number;
    valid_tool_calls: number;
    failed_tool_calls: number;
    tool_choice_runs: number;
    tool_choice_hits: number;
    tool_choice_accuracy: number | null;
    checks_passed: number;
    checks_total: number;
    errors: number;
    seconds: number;
    model_calls: number;
    completion_tokens: number;
};
export declare function summarize(results: RunResult[], runners: string[]): Record<string, RunnerSummary>;
export declare function formatSummary(summary: Record<string, RunnerSummary>): string;
export declare function formatToolUse(summary: Record<string, RunnerSummary>): string;
export type PassRecord = {
    task_id: string;
    runner: string;
    passed: boolean;
};
export declare function taskPassCounts(results: PassRecord[]): Record<string, Record<string, [number, number]>>;
export declare function passEveryRound(results: PassRecord[], runner: string): {
    tasks: number;
    passed: number;
    rate: number;
};
export declare function formatTaskPasses(counts: Record<string, Record<string, [number, number]>>, runners: string[]): string;
export declare function formatUnsteadyTasks(counts: Record<string, Record<string, [number, number]>>): string;
export declare function formatResult(result: RunResult, showAttempt?: boolean): string;
export type PairedRow = {
    task_id: string;
    runner: string;
    old: [number, number] | null;
    new: [number, number] | null;
    change: number | null;
};
export type PairedTotals = {
    runner: string;
    old: {
        passed: number;
        runs: number;
        every_round: number;
        tasks: number;
    } | null;
    new: {
        passed: number;
        runs: number;
        every_round: number;
        tasks: number;
    } | null;
    better: number;
    worse: number;
    same: number;
};
export declare function loadResultRecords(path: string): PassRecord[];
export declare function compareResults(oldRecords: PassRecord[], newRecords: PassRecord[]): {
    rows: PairedRow[];
    totals: PairedTotals[];
};
export declare function formatComparison(comparison: {
    rows: PairedRow[];
    totals: PairedTotals[];
}, oldName: string, newName: string): string;
export type EvalArguments = {
    tasks: string | null;
    settings: string;
    runners: string;
    only: string | null;
    output: string | null;
    seed_store: string | null;
    seed: string | null;
    repeat: number;
    model_path: string | null;
    stream: boolean;
    compare: string | null;
    against: string | null;
    prompts: string | null;
};
export declare function parseEvalArguments(argv: string[]): EvalArguments;
export declare function main(argv?: string[]): Promise<number>;
