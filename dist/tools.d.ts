import type { ActionRecord } from './checks.js';
import type { ToolDefinition } from './model.js';
export declare const MAX_FILE_BYTES = 100000;
export declare const MAX_TOOL_OUTPUT_CHARS = 12000;
export declare const MAX_WEB_PAGE_BYTES = 2000000;
export declare const MAX_WEB_PAGE_CHARS = 100000;
export declare const MAX_DIRECTORY_ENTRIES = 100;
export declare const TEST_TIMEOUT_SECONDS = 120;
export declare const WEB_FETCH_TIMEOUT_SECONDS = 15;
export declare const MAX_REDIRECTS = 10;
export declare const SENSITIVE_NAMES: Set<string>;
export declare const SEARCH_URL = "https://html.duckduckgo.com/html/";
export declare const PYTHON_COMMAND = "python3";
export declare const HARNESS_FOLDER = ".codex";
export declare const READ_ONLY_TOOL_NAMES: Set<string>;
export declare const ACTION_TOOL_NAMES: Set<string>;
export declare const TOOL_DEFINITIONS: ToolDefinition[];
export declare const RUN_TESTS_DEFINITION: ToolDefinition;
export declare class ValueError extends Error {
    name: string;
}
export declare function unescapeHtml(text: string): string;
export declare function extractHtmlText(html: string): {
    title: string;
    text: string;
};
export declare function isPublicAddress(address: string): boolean;
export type HostResolver = (hostname: string) => Promise<string[]>;
export declare function validatePublicWebUrl(url: string, resolveHost?: HostResolver): Promise<string>;
export declare function resolvePath(path: string): string;
export declare function isSensitivePath(path: string): boolean;
export declare function isHarnessPath(path: string): boolean;
export type SearchResult = {
    title: string;
    url: string;
    snippet: string;
};
export type WebPage = {
    url: string;
    title: string;
    text: string;
    truncated: boolean;
};
export type ToolboxOptions = {
    maxSearchResults?: number;
    enableTestExecution?: boolean;
    allowFileWrites?: boolean;
    searchCallback?: ((query: string, results: SearchResult[]) => void) | null;
    fetch?: typeof fetch;
    resolveHost?: HostResolver;
};
export declare class Toolbox {
    readonly root: string;
    readonly maxSearchResults: number;
    readonly enableTestExecution: boolean;
    readonly allowFileWrites: boolean;
    readonly searchCallback: ((query: string, results: SearchResult[]) => void) | null;
    readonly usedTools: Set<string>;
    readonly actionLog: ActionRecord[];
    readonly pathsSeen: string[];
    readonly toolDefinitions: ToolDefinition[];
    private readonly fetchPage;
    private readonly resolveHost;
    constructor(filesystemRoot: string, options?: ToolboxOptions);
    call(name: string, argumentsGiven: unknown): Promise<string>;
    private callTool;
    private webSearch;
    private searchDuckDuckGo;
    private webFetch;
    private downloadWebPage;
    private resolveInsideRoot;
    private missingPathMessage;
    private listDirectory;
    private readFile;
    private writeFile;
    private runTests;
}
export declare function parseSearchResults(html: string): SearchResult[];
