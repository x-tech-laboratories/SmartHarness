import { type Section } from './contextBudget.js';
import { KnowledgeStore } from './knowledge.js';
import { type ChatModel, type ModelCache } from './model.js';
import { type Settings } from './settings.js';
export declare const BACKGROUND_PAGES_PER_TOPIC = 2;
export declare const EPISODES_PER_PASS = 5;
export declare const CONFIDENCE_LEVELS: Readonly<Record<string, number>>;
export declare const FACTS_PER_CALL = 5;
export declare const FACTS_SCHEMA: {
    type: string;
    properties: {
        facts: {
            type: string;
            items: {
                type: string;
                properties: {
                    statement: {
                        type: string;
                    };
                    source: {
                        type: string;
                    };
                    confidence: {
                        type: string;
                        enum: string[];
                    };
                };
                required: string[];
            };
            maxItems: number;
        };
    };
    required: string[];
};
export declare const OVERVIEW_SCHEMA: {
    type: string;
    properties: {
        summary: {
            type: string;
        };
        relationships: {
            type: string;
            items: {
                type: string;
                properties: {
                    subject: {
                        type: string;
                    };
                    relation: {
                        type: string;
                    };
                    object: {
                        type: string;
                    };
                    source: {
                        type: string;
                    };
                };
                required: string[];
            };
            maxItems: number;
        };
    };
    required: string[];
};
export declare const SUMMARY_SCHEMA: {
    type: string;
    properties: {
        summary: {
            type: string;
        };
    };
    required: string[];
};
export declare const MEMORY_SCHEMA: {
    type: string;
    properties: {
        memories: {
            type: string;
            items: {
                type: string;
                properties: {
                    store: {
                        type: string;
                        enum: ("code" | "general" | "locations" | "project" | "research" | "software" | "user")[];
                    };
                    statement: {
                        type: string;
                    };
                    reason: {
                        type: string;
                        maxLength: number;
                    };
                };
                required: string[];
            };
            maxItems: number;
        };
        research_topics: {
            type: string;
            items: {
                type: string;
                maxLength: number;
            };
            maxItems: number;
        };
    };
    required: string[];
};
export declare class BackgroundPaused extends Error {
    name: string;
    constructor();
}
export type ModelLock = {
    acquire(): Promise<void>;
    release(): void;
};
export type BackgroundOptions = {
    onProgress?: ((message: string) => void) | null;
    onToken?: ((token: string) => void) | null;
    shouldPause?: (() => boolean) | null;
    llm?: ChatModel | null;
    modelLock?: ModelLock | null;
    modelCache?: ModelCache | null;
};
export declare function rethrowPause(error: unknown): void;
export declare class BackgroundModel {
    readonly settings: Settings;
    readonly onToken: ((token: string) => void) | null;
    readonly shouldPause: (() => boolean) | null;
    readonly modelLock: ModelLock | null;
    readonly modelCache: ModelCache | null;
    readonly maxTokens: number;
    readonly modelPath: string;
    readonly contextSize: number;
    readonly gpuLayers: number;
    private llm;
    constructor(settings: Settings, onToken: ((token: string) => void) | null, shouldPause: (() => boolean) | null, llm: ChatModel | null, modelLock: ModelLock | null, modelCache: ModelCache | null);
    static fromOptions(settings: Settings, options: BackgroundOptions): BackgroundModel;
    checkPause(): void;
    private load;
    private locked;
    run(systemPrompt: string, userInput: string, jsonSchema?: Record<string, unknown> | null): Promise<string>;
    fit(systemPrompt: string, sections: Section[], pinned?: number): Promise<string>;
    summarizePage(pageJson: string, topic: string): Promise<string>;
}
export type Source = {
    number: number;
    url: string;
    text: string;
};
export type Fact = [statement: string, sourceUrl: string | null, confidence: number];
export type Relationship = [subject: string, relation: string, target: string, sourceUrl: string | null];
export type Overview = {
    summary: string;
    relationships: Relationship[];
};
export declare function numberSources(results: unknown[], pageSummaries: Map<string, string>): [Source[], Source[]];
export declare function completeSentences(snippet: string): string;
export declare function parseJson(reply: string): unknown;
export declare function parseFacts(reply: string, urls: Map<number, string>): Fact[];
export declare function parseOverview(reply: string, urls: Map<number, string>): Overview;
export declare function groundedSummary(summary: string, sources: Source[]): string;
export declare function groundedFacts(facts: Fact[], sources: Source[]): Fact[];
export declare function pageText(pageJson: string): string;
export declare function shortenPage(pageJson: string, maxChars: number): string;
export declare const FACTS_PROMPT: string;
export declare const OVERVIEW_PROMPT: string;
export declare function researchOneTopic(settings: Settings, options?: BackgroundOptions): Promise<boolean>;
export declare const PARENT_SUMMARY_PROMPT: string;
export declare function refreshParentSummary(store: KnowledgeStore, model: BackgroundModel, parent: string): Promise<void>;
export declare const LEARNING_PROMPT: string;
export declare function groundedMemory(store: string, statement: string, seen: string): boolean;
export declare function learnFromEpisodes(settings: Settings, options?: BackgroundOptions): Promise<boolean>;
export declare const EMBEDDING_BATCH_SIZE = 8;
export declare function indexKnowledge(settings: Settings, options?: BackgroundOptions): Promise<boolean>;
