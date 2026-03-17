/**
 * MCP manager — orchestrates MCP server connections using MCPClient directly.
 * Created once at startup, provides tools from connected MCP servers.
 *
 * Each server gets its own MCPClient instance for independent lifecycle management.
 * A single server failure does not affect the others.
 */

import { MCPClient } from '@mastra/mcp';
import type { MastraMCPServerDefinition } from '@mastra/mcp';
import { loadMcpConfig, getProjectMcpPath, getGlobalMcpPath, getClaudeSettingsPath } from './config.js';
import type { McpConfig, McpHttpServerConfig, McpServerConfig, McpServerStatus, McpSkippedServer } from './types.js';

/** Summary of MCP initialization result. */
export interface McpInitResult {
  connected: McpServerStatus[];
  failed: McpServerStatus[];
  skipped: McpSkippedServer[];
  totalTools: number;
}

/** Public interface for the MCP manager returned by createMcpManager(). */
export interface McpManager {
  /** Connect to all configured MCP servers and collect their tools. */
  init(): Promise<void>;
  /** Start init in the background. Returns a promise that resolves with status when done. */
  initInBackground(): Promise<McpInitResult>;
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

function buildServerDef(cfg: McpServerConfig): MastraMCPServerDefinition {
  if ('url' in cfg) {
    const httpCfg = cfg as McpHttpServerConfig;
    return {
      url: new URL(httpCfg.url),
      requestInit: httpCfg.headers ? { headers: httpCfg.headers } : undefined,
    };
  }
  return { command: cfg.command, args: cfg.args, env: cfg.env, stderr: 'pipe' };
}

/**
 * Create an MCP manager that wraps MCPClient with config-file discovery
 * and per-server status tracking.
 *
 * Each server gets its own MCPClient instance so that a failure in one
 * server does not block or take down the others.
 */
export function createMcpManager(projectDir: string, extraServers?: Record<string, McpServerConfig>): McpManager {
  /** Merge programmatic servers into a base config (highest priority). */
  const applyExtraServers = (base: McpConfig): McpConfig => {
    if (!extraServers || Object.keys(extraServers).length === 0) return base;
    return { ...base, mcpServers: { ...base.mcpServers, ...extraServers } };
  };

  let config = applyExtraServers(loadMcpConfig(projectDir));
  /** One MCPClient per server, keyed by server name. */
  let clients = new Map<string, MCPClient>();
  let tools: Record<string, any> = {};
  let serverStatuses = new Map<string, McpServerStatus>();
  let initialized = false;

  /** Connect a single server independently. Returns its tools on success. */
  async function connectServer(
    name: string,
    cfg: McpServerConfig,
  ): Promise<{ name: string; tools: Record<string, any> } | { name: string; error: string }> {
    const client = new MCPClient({
      id: `mastra-code-mcp-${name}`,
      servers: { [name]: buildServerDef(cfg) },
    });
    clients.set(name, client);

    try {
      const serverTools = await client.listTools();
      return { name, tools: serverTools };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      return { name, error: errMsg };
    }
  }

  /** Connect all configured servers independently using Promise.allSettled. */
  async function connectAndCollectTools(): Promise<void> {
    const servers = config.mcpServers;
    if (!servers || Object.keys(servers).length === 0) {
      return;
    }

    const results = await Promise.allSettled(
      Object.entries(servers).map(([name, cfg]) => connectServer(name, cfg)),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        // Unexpected — connectServer already catches errors internally.
        continue;
      }

      const value = result.value;
      if ('error' in value) {
        serverStatuses.set(value.name, {
          name: value.name,
          connected: false,
          toolCount: 0,
          toolNames: [],
          transport: getTransport(servers[value.name]!),
          error: value.error,
        });
      } else {
        const serverToolNames = Object.keys(value.tools);
        Object.assign(tools, value.tools);
        serverStatuses.set(value.name, {
          name: value.name,
          connected: true,
          toolCount: serverToolNames.length,
          toolNames: serverToolNames,
          transport: getTransport(servers[value.name]!),
        });
      }
    }
  }

  async function disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(clients.values()).map(client =>
      client.disconnect().catch(() => {}),
    );
    await Promise.allSettled(disconnectPromises);
    clients.clear();
  }

  function buildInitResult(): McpInitResult {
    const statuses = Array.from(serverStatuses.values());
    const connected = statuses.filter(s => s.connected);
    const failed = statuses.filter(s => !s.connected);
    return {
      connected,
      failed,
      skipped: [...(config.skippedServers ?? [])],
      totalTools: connected.reduce((sum, s) => sum + s.toolCount, 0),
    };
  }

  return {
    async init() {
      if (initialized) return;
      await connectAndCollectTools();
      initialized = true;
    },

    async initInBackground(): Promise<McpInitResult> {
      if (initialized) {
        return buildInitResult();
      }
      await connectAndCollectTools();
      initialized = true;
      return buildInitResult();
    },

    async reload() {
      await disconnectAll();
      config = applyExtraServers(loadMcpConfig(projectDir));
      tools = {};
      serverStatuses = new Map();
      initialized = false;
      await connectAndCollectTools();
      initialized = true;
    },

    disconnect: disconnectAll,

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
