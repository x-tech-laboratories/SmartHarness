import type { ToolDefinition } from './model.js';
import type { McpServerSettings } from './settings.js';
export declare const INHERITED_VARIABLES: string[];
export declare function resolvePlaceholders(value: string, serverName: string): string;
export declare function functionName(serverName: string, toolName: string): string;
export declare class MCPToolbox {
    readonly servers: McpServerSettings[];
    readonly toolDefinitions: ToolDefinition[];
    private readonly routes;
    private readonly clients;
    constructor(servers: McpServerSettings[]);
    open(): Promise<this>;
    close(): Promise<void>;
    handles(toolName: string): boolean;
    call(toolName: string, argumentsGiven: Record<string, unknown>): Promise<string>;
    private connectServer;
}
