import { type ChatModel } from './model.js';
export declare const CODE_KINDS: readonly ['list', 'filter', 'sort', 'select', 'intersect', 'batch', 'check', 'notify'];
export declare const MODEL_KINDS: readonly ['classify', 'extract', 'lookup', 'write'];
export declare const STOP_KINDS: readonly ['ask_user', 'act'];
export declare const STEP_KINDS: readonly ["list", "filter", "sort", "select", "intersect", "batch", "check", "notify", "classify", "extract", "lookup", "write", "ask_user", "act"];
export type StepKind = (typeof STEP_KINDS)[number];
export declare const LIST_KINDS: readonly StepKind[];
export declare const PER_ITEM_KINDS: readonly StepKind[];
export declare const FILTER_OPERATORS: readonly ['equals', 'not_equals', 'contains', 'before', 'after', 'at_least', 'at_most'];
export declare const SORT_ORDERS: readonly ['ascending', 'descending'];
export declare const CHECK_RULES: readonly ['every_item_once', 'not_empty'];
export declare const MAX_STEPS = 16;
export declare const MAX_LABELS = 12;
export declare const MAX_WORDS_LIMIT = 400;
export type Catalogue = {
    sources: string[];
    agents: string[];
};
export declare const DEFAULT_CATALOGUE: Catalogue;
export type Step = {
    id: string;
    kind: StepKind;
    inputs: string[];
    each: string;
    [field: string]: unknown;
};
export type Blueprint = {
    name: string;
    request_shape: string;
    inputs: string[];
    steps: Step[];
    output: string;
};
export declare function kindFields(catalogue: Catalogue): Record<StepKind, Record<string, unknown>>;
export declare function blueprintSchema(catalogue?: Catalogue): Record<string, unknown>;
export declare function validateBlueprint(draft: unknown, catalogue?: Catalogue): string[];
export declare const BLUEPRINT_MAX_TOKENS = 3072;
export type BlueprintDraft = {
    request: string;
    first: unknown;
    firstProblems: string[];
    final: unknown;
    problems: string[];
    repaired: boolean;
};
export declare function draftInput(request: string): string;
export declare function repairInput(request: string, draft: unknown, problems: string[]): string;
export declare function draftBlueprint(llm: ChatModel, request: string, catalogue?: Catalogue, options?: {
    signal?: AbortSignal;
    useGrammar?: boolean;
}): Promise<BlueprintDraft>;
