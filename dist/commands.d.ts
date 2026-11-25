import { type MemoryStore as StoreName } from './knowledge.js';
export declare const MEMORY_COMMANDS: readonly ['/remember', '/forget', '/memories'];
export declare const STORE_ALIASES: Record<string, StoreName>;
export type Memory = {
    id: number;
    store: string;
    statement: string;
    reason: string;
    origin: string;
    scope: string;
};
export type MemoryStore = {
    addMemory(store: string, statement: string, options?: {
        reason?: string;
        origin?: string;
        scope?: string;
    }): number;
    memories(options?: {
        limit?: number;
        scope?: string | null;
        stores?: readonly string[];
    }): Array<Record<string, unknown>>;
    forgetMemory(memoryId: number): boolean;
};
export declare function isMemoryCommand(userPrompt: string): boolean;
export declare function runMemoryCommand(userPrompt: string, knowledgeStore: MemoryStore | null, scope: string): string;
export declare const COMMAND_MODES: readonly ['answer', 'draft', 'execute'];
export declare class Command {
    name: string;
    description: string;
    mode: string | null;
    template: string;
    path: string;
    constructor(name: string, description: string, mode: string | null, template: string, path: string);
}
export declare function commandDirectories(filesystemRoot: string): string[];
export declare function loadCommands(filesystemRoot: string): Map<string, Command>;
export declare const INIT_PROMPT: string;
export declare function expandCommand(userPrompt: string, filesystemRoot: string, allowFileWrites: boolean): [string | null, string];
