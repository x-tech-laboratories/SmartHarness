import { type BackgroundOptions } from './background.js';
import { KnowledgeStore, type EventRecord } from './knowledge.js';
import type { Settings } from './settings.js';
import { type ExecuteTaskTreeOptions } from './taskTree.js';
export type TreeRunner = (prompt: string, options: ExecuteTaskTreeOptions) => Promise<string>;
export type EventContext<Values extends Settings = Settings> = {
    settings: Values;
    store: KnowledgeStore;
    options: BackgroundOptions;
    runTree: TreeRunner;
};
export type EventOutcome = {
    status: 'done' | 'ignored';
    detail: string;
};
export type EventHandler<Values extends Settings = Settings> = (event: EventRecord, context: EventContext<Values>) => Promise<EventOutcome>;
export declare const notifyHandler: EventHandler;
export declare const DEFAULT_EVENT_HANDLERS: ReadonlyMap<string, EventHandler>;
export declare function handleNextEvent<Values extends Settings>(settings: Values, options?: BackgroundOptions, handlers?: ReadonlyMap<string, EventHandler<Values>>, runTree?: TreeRunner): Promise<boolean>;
