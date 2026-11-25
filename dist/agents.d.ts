export declare const MAX_AGENT_DEPTH = 3;
export declare const MAX_AGENT_INSTRUCTIONS_CHARS = 2000;
export declare class AgentDefinition {
    name: string;
    description: string;
    instructions: string;
    mcpServers: string[];
    agents: string[];
    constructor(name: string, description: string, instructions?: string, mcpServers?: string[], agents?: string[]);
}
export type NamedServer = {
    name: string;
};
export declare function agentDirectories(filesystemRoot: string): string[];
export declare const STARTER_AGENTS_DIRECTORY: string;
export declare function installStarterAgents(target?: string, source?: string): boolean;
export declare function loadFrontMatter(text: string): unknown;
export declare function parseAgent(name: string, text: string): AgentDefinition | null;
export declare function loadAgents(filesystemRoot: string): Map<string, AgentDefinition>;
export declare function topLevelAgents(agents: Map<string, AgentDefinition>): string[];
export declare function usableAgents(agents: Map<string, AgentDefinition>, connectedServers: Iterable<string>): Map<string, AgentDefinition>;
export declare function claimedServers(agents: Map<string, AgentDefinition>): Set<string>;
export declare function serversBehind(name: string, agents: Map<string, AgentDefinition>, seen?: Set<string>): string[];
export declare function serversFor<Server extends NamedServer>(agent: AgentDefinition | null, agents: Map<string, AgentDefinition>, servers: Server[]): Server[];
