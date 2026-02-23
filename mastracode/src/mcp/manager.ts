/**
 * MCP manager — orchestrates MCP server connections using MCPClient directly.
 * Created once at startup, provides tools from connected MCP servers.
 */

import { MCPClient } from '@mastra/mcp';
import { loadMcpConfig, getProjectMcpPath, getGlobalMcpPath, getClaudeSettingsPath } from './config.js';
import type { McpConfig, McpServerStatus } from './types.js';

/** Public interface for the MCP manager returned by createMcpManager(). */
export interface McpManager {
  /** Connect to all configured MCP servers and collect their tools. */
  init(): Promise<void>;
  /** Disconnect all servers, reload config from disk, reconnect. */
  reload(): Promise<void>;
  /** Disconnect from all MCP servers and clean up. */
  disconnect(): Promise<void>;
  /** Get all tools from connected MCP servers (namespaced as serverName_toolName). */
  getTools(): Record<string, any>;
  /** Check if any MCP servers are configured. */
  hasServers(): boolean;
  /** Get status of all servers. */
  getServerStatuses(): McpServerStatus[];
  /** Get config file paths for display. */
  getConfigPaths(): { project: string; global: string; claude: string };
  /** Get the merged config. */
  getConfig(): McpConfig;
}

/**
 * Create an MCP manager that wraps MCPClient with config-file discovery
 * and per-server status tracking.
 */
export function createMcpManager(projectDir: string): McpManager {
  let config = loadMcpConfig(projectDir);
  let client: MCPClient | null = null;
  let tools: Record<string, any> = {};
  let serverStatuses = new Map<string, McpServerStatus>();
  let initialized = false;

  function buildServerDefs(
    servers: Record<string, { command: string; args?: string[]; env?: Record<string, string> }>,
  ) {
    const defs: Record<string, { command: string; args?: string[]; env?: Record<string, string> }> = {};
    for (const [name, cfg] of Object.entries(servers)) {
      defs[name] = { command: cfg.command, args: cfg.args, env: cfg.env };
    }
    return defs;
  }

  async function connectAndCollectTools(): Promise<void> {
    const servers = config.mcpServers;
    if (!servers || Object.keys(servers).length === 0) {
      return;
    }

    client = new MCPClient({
      id: 'mastra-code-mcp',
      servers: buildServerDefs(servers),
    });

    // MCPClient.listTools() uses Promise.all internally — a single server
    // failure throws for all. We call it once wrapped in try/catch and
    // derive per-server status from tool name prefixes (serverName_toolName).
    const serverNames = Object.keys(servers);

    try {
      tools = await client.listTools();

      for (const name of serverNames) {
        const prefix = `${name}_`;
        const serverToolNames = Object.keys(tools).filter(t => t.startsWith(prefix));
        serverStatuses.set(name, {
          name,
          connected: true,
          toolCount: serverToolNames.length,
          toolNames: serverToolNames,
        });
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);

      for (const name of serverNames) {
        serverStatuses.set(name, {
          name,
          connected: false,
          toolCount: 0,
          toolNames: [],
          error: errMsg,
        });
      }
    }
  }

  async function disconnect(): Promise<void> {
    if (client) {
      try {
        await client.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      client = null;
    }
  }

  return {
    async init() {
      if (initialized) return;
      await connectAndCollectTools();
      initialized = true;
    },

    async reload() {
      await disconnect();
      config = loadMcpConfig(projectDir);
      tools = {};
      serverStatuses = new Map();
      initialized = false;
      await connectAndCollectTools();
      initialized = true;
    },

    disconnect,

    getTools() {
      return { ...tools };
    },

    hasServers() {
      return config.mcpServers !== undefined && Object.keys(config.mcpServers).length > 0;
    },

    getServerStatuses() {
      return Array.from(serverStatuses.values());
    },

    getConfigPaths() {
      return {
        project: getProjectMcpPath(projectDir),
        global: getGlobalMcpPath(),
        claude: getClaudeSettingsPath(projectDir),
      };
    },

    getConfig() {
      return config;
    },
  };
}
