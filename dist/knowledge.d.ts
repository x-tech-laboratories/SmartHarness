import { DatabaseSync } from 'node:sqlite';
import { type TextEmbedder } from './embeddings.js';
export declare const MIGRATIONS: readonly string[];
export declare const EVENT_TRUSTS: readonly ['user', 'external'];
export type EventTrust = (typeof EVENT_TRUSTS)[number];
export declare const ACTION_RESOLUTIONS: readonly ['approved', 'rejected', 'done'];
export type ActionResolution = (typeof ACTION_RESOLUTIONS)[number];
export type ResolvedAction = {
    id: number;
    kind: string;
    payload: string;
    resolution: ActionResolution;
    resolvedAt: number;
};
export type ResolvedActionHook = (connection: Connection, action: ResolvedAction) => void;
export type SchemaExtension = {
    name: string;
    migrations: readonly string[];
};
export declare const MAX_EVENT_PAYLOAD_CHARS = 100000;
export type NewEvent = {
    source: string;
    type: string;
    payload?: Record<string, unknown>;
    dedupeKey?: string;
    trust?: EventTrust;
    priority?: number;
};
export type EventRecord = {
    id: number;
    source: string;
    type: string;
    dedupe_key: string;
    trust: EventTrust;
    priority: number;
    payload: Record<string, unknown>;
    received_at: number;
};
export type NewAction = {
    eventId?: number | null;
    kind: string;
    title: string;
    body?: string;
    payload?: Record<string, unknown>;
};
export declare const MEMORY_KINDS: readonly ['fact', 'episode'];
export declare const TASK_RUN_STATUSES: readonly ['running', 'stopped', 'finished', 'discarded'];
export declare const RESUMABLE_TASK_RUN_STATUSES: readonly ['running', 'stopped'];
export declare const MEMORY_STORES: readonly ['general', 'user', 'locations', 'software', 'project', 'research', 'code'];
export declare const MEMORY_STORE_LABELS: Record<MemoryStore, string>;
export declare const SCOPED_MEMORY_STORES: readonly MemoryStore[];
export declare const SKILL_MEMORY_STORES: readonly MemoryStore[];
export declare const MEMORY_ORIGINS: readonly ['learned', 'probed', 'user'];
export declare const MAX_RECALLED_MEMORIES: Record<MemoryStore, number>;
export declare const CONSOLIDATION_KINDS: readonly ['topic', 'fact', 'memory'];
export declare const SIMILAR_OVERLAP = 0.5;
export declare const PRUNE_BELOW_CONFIDENCE = 0.5;
export declare const MAX_RESEARCH_FAILURES = 3;
export declare const EVICT_TO_SHARE_OF_CAP = 0.9;
export declare const EVICT_BATCH_SIZE = 100;
export declare const MAX_TOPIC_NAME_WORDS = 5;
export declare const MAX_TOPIC_NAME_CHARS = 40;
export declare const OFTEN_USED_TOPIC_COUNT = 5;
export declare const SOURCE_TTL_SECONDS: number;
export declare const MAX_RECALLED_RELATIONSHIPS = 5;
export declare const FACT_SIMILARITY = 0.45;
export declare const TOPIC_SIMILARITY = 0.5;
export declare const DUPLICATE_SIMILARITY = 0.75;
export declare const FUSION_RANK_OFFSET = 60;
export declare const RECALL_MIN_SHARED_TERMS = 3;
export type MemoryStore = (typeof MEMORY_STORES)[number];
export type MemoryOrigin = (typeof MEMORY_ORIGINS)[number];
export type TaskRunStatus = (typeof TASK_RUN_STATUSES)[number];
export type ConsolidationKind = (typeof CONSOLIDATION_KINDS)[number];
type SqlValue = string | number | bigint | null | Uint8Array;
export type Row = Record<string, any>;
export type SearchResult = {
    url?: string;
    title?: string;
    snippet?: string;
    [key: string]: unknown;
};
export type EmbeddingItem = [kind: string, itemId: number, body: string];
export type RecalledFact = {
    id: number;
    statement: string;
    confidence: number;
    topic_id: number;
    topic: string;
    source_url: string | null;
    retrieved_at: number;
    stale: boolean;
    topic_path: Array<{
        name: string;
        summary: string;
    }>;
};
export type RecalledRelationship = {
    subject: string;
    relation: string;
    object: string;
    source_url: string | null;
};
export type Recalled = {
    memories: Row[];
    facts: RecalledFact[];
    episodes: Row[];
    relationships: RecalledRelationship[];
};
export type TaskRun = Row & {
    options: Record<string, unknown>;
    state: Record<string, unknown> | null;
};
export type ConversationKind = 'task_run' | 'episode';
export type Conversation = {
    kind: ConversationKind;
    id: number;
    prompt: string;
};
export declare const WORD = "[\\p{L}\\p{N}_]";
export declare function casefold(text: string): string;
export declare function words(text: string, minimumLength: number): string[];
export declare function searchTerms(query: string): string[];
export declare function matchExpression(terms: string[]): string;
export declare function comparisonTerms(text: string): Set<string>;
export declare function overlap(first: Set<string>, second: Set<string>): number;
export declare function sharedTermCount(terms: string[], text: string): number;
export declare function sharesHalfTheTerms(terms: string[], text: string): boolean;
export declare function fuseRankings(...rankings: number[][]): number[];
export declare function firstChars(text: string, maximum: number): string;
export declare function now(): number;
export declare function sqliteVecAvailable(): boolean | null;
export declare class Connection {
    readonly database: DatabaseSync;
    constructor(database: DatabaseSync);
    all(sql: string, ...parameters: SqlValue[]): Row[];
    get(sql: string, ...parameters: SqlValue[]): Row | undefined;
    value(sql: string, ...parameters: SqlValue[]): any;
    run(sql: string, ...parameters: SqlValue[]): {
        changes: number;
        lastInsertRowid: number;
    };
    runMany(sql: string, rows: SqlValue[][]): void;
    exec(sql: string): void;
}
export declare class KnowledgeStore {
    readonly path: string;
    readonly embedder: TextEmbedder | null;
    constructor(databasePath: string, embedder?: TextEmbedder | null);
    open(): DatabaseSync;
    transaction<T>(work: (connection: Connection) => T): T;
    applySchemaExtension(extension: SchemaExtension): void;
    private withConnection;
    addTopic(name: string, options?: {
        parent?: string | null;
        priority?: number | null;
    }): number;
    enqueueTopic(name: string, options?: {
        priority?: number | null;
        maxPending?: number;
    }): number;
    claimJob(): {
        id: number;
        topic_id: number;
        name: string;
    } | null;
    enqueueDueTopics(refreshIntervalHours: number, maxPending?: number): number;
    finishJob(jobId: number, error?: string): void;
    requeueInterruptedJobs(): number;
    deferJob(jobId: number): void;
    storeSearchResults(query: string, results: SearchResult[], options?: {
        topic?: string | null;
        ttlSeconds?: number;
        summary?: string;
    }): number;
    search(query: string, options?: {
        limit?: number;
    }): Row[];
    topics(): Row[];
    sources(topicId?: number | null, options?: {
        limit?: number;
    }): Row[];
    graph(): Row[];
    addRelationship(source: string, relation: string, target: string, sourceUrl?: string | null): void;
    addFact(topic: string, statement: string, sourceUrl?: string | null, confidence?: number): number;
    facts(options?: {
        topicId?: number | null;
        limit?: number;
    }): Row[];
    hasFacts(topic: string): boolean;
    setTopicSummary(topic: string, summary: string): void;
    setSourceSummary(url: string, summary: string): void;
    isResearched(topic: string): boolean;
    childSummaries(parent: string): Array<[name: string, summary: string]>;
    addMemory(store: string, statement: string, options?: {
        reason?: string;
        origin?: string;
        scope?: string;
    }): number;
    replaceProbedMemories(store: string, statements: string[]): void;
    memories(options?: {
        limit?: number;
        scope?: string | null;
        stores?: readonly string[];
    }): Row[];
    relevantMemories(query: string, options?: {
        scope?: string;
        stores?: readonly string[];
        countUse?: boolean;
    }): Row[];
    private countMemoryUse;
    forgetMemory(memoryId: number): boolean;
    recordEpisode(prompt: string, taskType: string, checklist: string, answer: string, outcome: string, options?: {
        taskTree?: string;
        scope?: string;
    }): number;
    episodes(options?: {
        unprocessedOnly?: boolean;
        limit?: number;
    }): Row[];
    startTaskRun(prompt: string, options: Record<string, unknown>): number;
    saveTaskRun(runId: number, state: Record<string, unknown>, tasksDone: number, tasksTotal: number): void;
    setTaskRunStatus(runId: number, status: string): void;
    taskRun(runId: number): TaskRun | null;
    unfinishedTaskRuns(options?: {
        limit?: number;
    }): Row[];
    nextConversationToTitle(): Conversation | null;
    setConversationTitle(kind: ConversationKind, conversationId: number, title: string): void;
    markEpisodeProcessed(episodeId: number): void;
    recall(query: string, options?: {
        limit?: number;
        includeMemories?: boolean;
        scope?: string;
    }): Promise<Recalled>;
    tidy(pruneAfterDays: number, maxPending?: number, maxMegabytes?: number | null): Record<string, number>;
    nextUncheckedPair(kind: string): [Row, Row] | null;
    private similarPairs;
    recordCheck(kind: string, firstId: number, secondId: number, verdict: string): void;
    mergeTopics(firstId: number, secondId: number): string;
    adoptTopic(parentId: number, childId: number): boolean;
    setTopicParent(topicId: number, parentId: number | null): boolean;
    nextTopicToPlace(reviewedBefore: number): Row | null;
    placementCandidates(topicId: number, options?: {
        limit?: number;
    }): Row[];
    nextTopicToName(): Row | null;
    renameTopic(topicId: number, name: string): string;
    removeUnsupportedTopic(topicId: number): boolean;
    forgetTopic(topicId: number): boolean;
    removeOrphans(): {
        sources: number;
        nodes: number;
    };
    markTopicUnplaced(topicId: number): void;
    markTopicPlaced(topicId: number): void;
    mergeFacts(firstId: number, secondId: number): void;
    disputeFacts(firstId: number, secondId: number): string;
    mergeMemories(firstId: number, secondId: number): void;
    supersedeMemory(firstId: number, secondId: number): void;
    queueStatus(): Row[];
    enqueueEvent(event: NewEvent, options?: {
        maxPending?: number;
    }): {
        id: number;
        duplicate: boolean;
    };
    claimEvent(): EventRecord | null;
    knownEventKeys(source: string, keys: string[]): string[];
    finishEvent(eventId: number, status: 'done' | 'ignored' | 'failed', detail?: string): void;
    deferEvent(eventId: number): void;
    requeueInterruptedEvents(): number;
    events(limit?: number): Row[];
    addAction(action: NewAction): number;
    actions(status?: string | null, limit?: number): Row[];
    resolveAction(actionId: number, resolution: ActionResolution, followUp?: ResolvedActionHook): boolean;
    exportSourceJson(source: Record<string, unknown>): string;
    private queryVector;
    itemsToEmbed(model: string, limit: number): EmbeddingItem[];
    saveEmbeddings(model: string, items: EmbeddingItem[], vectors: number[][]): void;
    private setParent;
    private breakTopicLoops;
    private mergeSameNamedTopics;
    private mergeSameWordedFacts;
    private mergeTopicInto;
    private topicId;
    private nodeId;
}
export {};
