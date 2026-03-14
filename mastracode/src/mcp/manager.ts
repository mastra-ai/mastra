/**
 * MCP manager — orchestrates MCP server connections using MCPClient directly.
 * Created once at startup, provides tools from connected MCP servers.
 */

import { MCPClient } from '@mastra/mcp';
import type { MastraMCPServerDefinition } from '@mastra/mcp';
import { DEFAULT_CONFIG_DIR } from '../constants.js';
import { loadMcpConfig, getProjectMcpPath, getGlobalMcpPath, getClaudeSettingsPath } from './config.js';
import type { McpConfig, McpHttpServerConfig, McpServerConfig, McpServerStatus, McpSkippedServer } from './types.js';

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
  /** Check if any MCP servers are configured (or skipped). */
  hasServers(): boolean;
  /** Get status of all servers. */
  getServerStatuses(): McpServerStatus[];
  /** Get servers that were skipped during config loading. */
  getSkippedServers(): McpSkippedServer[];
  /** Get config file paths for display. */
  getConfigPaths(): { project: string; global: string; claude: string };
  /** Get the merged config. */
  getConfig(): McpConfig;
}

function getTransport(cfg: McpServerConfig): 'stdio' | 'http' {
  return 'url' in cfg ? 'http' : 'stdio';
}

/**
 * Create an MCP manager that wraps MCPClient with config-file discovery
 * and per-server status tracking.
 */
export function createMcpManager(projectDir: string, configDirName = DEFAULT_CONFIG_DIR, extraServers?: Record<string, McpServerConfig>): McpManager {
  /** Merge programmatic servers into a base config (highest priority). */
  const applyExtraServers = (base: McpConfig): McpConfig => {
    if (!extraServers || Object.keys(extraServers).length === 0) return base;
    return { ...base, mcpServers: { ...base.mcpServers, ...extraServers } };
  };

  let config = applyExtraServers(loadMcpConfig(projectDir, configDirName));
  let client: MCPClient | null = null;
  let tools: Record<string, any> = {};
  let serverStatuses = new Map<string, McpServerStatus>();
  let initialized = false;

  function buildServerDefs(servers: Record<string, McpServerConfig>): Record<string, MastraMCPServerDefinition> {
    const defs: Record<string, MastraMCPServerDefinition> = {};
    for (const [name, cfg] of Object.entries(servers)) {
      if ('url' in cfg) {
        const httpCfg = cfg as McpHttpServerConfig;
        defs[name] = {
          url: new URL(httpCfg.url),
          requestInit: httpCfg.headers ? { headers: httpCfg.headers } : undefined,
        };
      } else {
        defs[name] = { command: cfg.command, args: cfg.args, env: cfg.env };
      }
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
          transport: getTransport(servers[name]!),
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
          transport: getTransport(servers[name]!),
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
      config = applyExtraServers(loadMcpConfig(projectDir, configDirName));
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
      const hasConfigured = config.mcpServers !== undefined && Object.keys(config.mcpServers).length > 0;
      const hasSkipped = config.skippedServers !== undefined && config.skippedServers.length > 0;
      return hasConfigured || hasSkipped;
    },

    getServerStatuses() {
      return Array.from(serverStatuses.values());
    },

    getSkippedServers() {
      return [...(config.skippedServers ?? [])];
    },

    getConfigPaths() {
      return {
        project: getProjectMcpPath(projectDir, configDirName),
        global: getGlobalMcpPath(configDirName),
        claude: getClaudeSettingsPath(projectDir),
      };
    },

    getConfig() {
      return config;
    },
  };
}
