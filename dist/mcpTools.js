// Tools from MCP servers the user allows, offered to the model beside the built-in ones.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { MAX_TOOL_OUTPUT_CHARS, ValueError } from './tools.js';
// ============================================================================
// Settings
// ============================================================================
// Only these variables of CODEX's own environment reach a server it starts.
export const INHERITED_VARIABLES = ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'LANG', 'LC_ALL', 'LC_CTYPE', 'SSL_CERT_FILE', 'SSL_CERT_DIR'];
// Fill each ${NAME} in a setting from the environment, refusing a name that is not set.
export function resolvePlaceholders(value, serverName) {
    return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_placeholder, variableName) => {
        const variable = process.env[variableName];
        if (variable === undefined) {
            throw new ValueError(`Environment variable '${variableName}' required by MCP server '${serverName}' is not set.`);
        }
        return variable;
    });
}
// Name a server's tool for the model, refusing a name longer than models accept.
export function functionName(serverName, toolName) {
    const name = `mcp__${serverName}__${toolName}`.replace(/[^A-Za-z0-9_-]/g, '_');
    if (name.length > 64) {
        throw new ValueError(`MCP tool name '${serverName}/${toolName}' exceeds the 64-character limit.`);
    }
    return name;
}
function stdioTransport(server) {
    const environment = {};
    for (const key of INHERITED_VARIABLES) {
        const value = process.env[key];
        if (value !== undefined) {
            environment[key] = value;
        }
    }
    for (const [key, value] of Object.entries(server.env)) {
        environment[key] = resolvePlaceholders(value, server.name);
    }
    return new StdioClientTransport({ command: server.command, args: server.args, env: environment });
}
function httpTransport(server) {
    const headers = Object.fromEntries(Object.entries(server.headers).map(([key, value]) => [key, resolvePlaceholders(value, server.name)]));
    return new StreamableHTTPClientTransport(new URL(server.url), { requestInit: { headers } });
}
// Open with open(), and always close(), around the calls; a toolbox with no enabled servers opens nothing.
export class MCPToolbox {
    servers;
    toolDefinitions = [];
    routes = new Map();
    clients = [];
    constructor(servers) {
        this.servers = servers.filter((server) => server.enabled);
    }
    async open() {
        try {
            for (const server of this.servers) {
                await this.connectServer(server);
            }
        }
        catch (error) {
            await this.close();
            if (error instanceof ValueError) {
                throw error;
            }
            throw new Error(`Failed to start an MCP server: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
        }
        return this;
    }
    async close() {
        const clients = this.clients.splice(0).reverse();
        this.routes.clear();
        this.toolDefinitions.length = 0;
        for (const client of clients) {
            try {
                await client.close();
            }
            catch {
                // A server that already stopped has nothing left to close.
            }
        }
    }
    handles(toolName) {
        return this.routes.has(toolName);
    }
    async call(toolName, argumentsGiven) {
        const route = this.routes.get(toolName);
        if (route === undefined) {
            return `Tool error: unknown MCP tool '${toolName}'.`;
        }
        let result;
        try {
            result = await route.client.callTool({ name: route.toolName, arguments: argumentsGiven });
        }
        catch (error) {
            const kind = error instanceof Error ? error.name : 'Error';
            const message = error instanceof Error ? error.message : String(error);
            return `MCP tool error: ${kind}: ${message}`.slice(0, MAX_TOOL_OUTPUT_CHARS);
        }
        const content = Array.isArray(result.content) ? result.content : [];
        const parts = content.map((item) => (item.type === 'text' ? (item.text ?? '') : `[Non-text MCP result omitted: ${item.type ?? 'unknown'}]`));
        let output = parts.join('\n') || 'MCP tool returned no text content.';
        if (result.isError) {
            output = `MCP tool error: ${output}`;
        }
        return output.slice(0, MAX_TOOL_OUTPUT_CHARS);
    }
    async connectServer(server) {
        const transport = server.transport === 'http' ? httpTransport(server) : stdioTransport(server);
        const client = new Client({ name: 'codex', version: '0.1.0' });
        await client.connect(transport);
        this.clients.push(client);
        const response = await client.listTools();
        const discovered = new Map(response.tools.map((tool) => [tool.name, tool]));
        const missingTools = server.allowed_tools.filter((name) => !discovered.has(name)).sort();
        if (missingTools.length > 0) {
            throw new ValueError(`MCP server '${server.name}' does not provide allowed tool(s): ${missingTools.join(', ')}.`);
        }
        for (const toolName of server.allowed_tools) {
            const tool = discovered.get(toolName);
            const name = functionName(server.name, toolName);
            if (this.routes.has(name)) {
                throw new ValueError(`Duplicate MCP function name: ${name}.`);
            }
            const inputSchema = tool.inputSchema;
            if (typeof inputSchema !== 'object' || inputSchema === null || Array.isArray(inputSchema)) {
                throw new ValueError(`MCP tool '${server.name}/${toolName}' has an invalid input schema.`);
            }
            this.toolDefinitions.push({
                type: 'function',
                function: {
                    name,
                    description: tool.description || `MCP tool ${toolName}`,
                    parameters: inputSchema,
                },
            });
            this.routes.set(name, { client, toolName });
        }
    }
}
