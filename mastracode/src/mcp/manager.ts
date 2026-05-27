/**
 * MCP manager — orchestrates MCP server connections using MCPClient directly.
 * Created once at startup, provides tools from connected MCP servers.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { MCPClient, MCPOAuthClientProvider } from '@mastra/mcp';
import type { MastraMCPServerDefinition, OAuthClientInformation, OAuthStorage } from '@mastra/mcp';
import { DEFAULT_CONFIG_DIR } from '../constants.js';
import { getAppDataDir } from '../utils/project.js';
import { loadMcpConfig, getProjectMcpPath, getGlobalMcpPath, getClaudeSettingsPath } from './config.js';
import type { McpConfig, McpHttpServerConfig, McpServerConfig, McpServerStatus, McpSkippedServer } from './types.js';

const MASTRACODE_MCP_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
  /** Reconnect a single server by name. Returns updated status. */
  reconnectServer(name: string): Promise<McpServerStatus>;
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
  /** Get captured stderr logs for a server. */
  getServerLogs(name: string): string[];
}

function getTransport(cfg: McpServerConfig): 'stdio' | 'http' {
  return 'url' in cfg ? 'http' : 'stdio';
}

class FileOAuthStorage implements OAuthStorage {
  constructor(private filePath: string) {}

  get(key: string): string | undefined {
    return this.read()[key];
  }

  set(key: string, value: string): void {
    const data = this.read();
    data[key] = value;
    this.write(data);
  }

  delete(key: string): void {
    const data = this.read();
    delete data[key];
    this.write(data);
  }

  private read(): Record<string, string> {
    if (!existsSync(this.filePath)) return {};
    try {
      return JSON.parse(readFileSync(this.filePath, 'utf-8')) as Record<string, string>;
    } catch {
      return {};
    }
  }

  private write(data: Record<string, string>): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    const tmpPath = `${this.filePath}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 });
    renameSync(tmpPath, this.filePath);
  }
}

function getOAuthStoragePath(projectDir: string, name: string, cfg: McpHttpServerConfig): string {
  const key = JSON.stringify({
    projectDir,
    name,
    url: cfg.url,
    redirectUrl: cfg.oauth?.redirectUrl,
    clientId: cfg.oauth?.clientId,
    scopes: cfg.oauth?.scopes ?? [],
  });
  return join(getAppDataDir(), 'mcp-oauth', `${getStorageKeyFingerprint(key)}.json`);
}

function getStorageKeyFingerprint(value: string): string {
  let fingerprint = 0xcbf29ce484222325n;
  for (let i = 0; i < value.length; i += 1) {
    fingerprint ^= BigInt(value.charCodeAt(i));
    fingerprint = BigInt.asUintN(64, fingerprint * 0x100000001b3n);
  }
  return fingerprint.toString(16).padStart(16, '0');
}

/**
 * Create an MCP manager that wraps MCPClient with config-file discovery
 * and per-server status tracking.
 */
export function createMcpManager(
  projectDir: string,
  configDirName = DEFAULT_CONFIG_DIR,
  extraServers?: Record<string, McpServerConfig>,
): McpManager {
  /** Merge programmatic servers into a base config (highest priority). */
  const applyExtraServers = (base: McpConfig): McpConfig => {
    if (!extraServers || Object.keys(extraServers).length === 0) return base;
    return { ...base, mcpServers: { ...base.mcpServers, ...extraServers } };
  };

  let config = applyExtraServers(loadMcpConfig(projectDir, configDirName));
  let client: MCPClient | null = null;
  let tools: Record<string, any> = {};
  let serverStatuses = new Map<string, McpServerStatus>();
  let stderrLogs = new Map<string, string[]>();
  let initialized = false;

  const MAX_STDERR_LINES = 200;

  /** Hook into a server's stderr stream and buffer its output. */
  function captureStderr(serverName: string): void {
    if (!client || typeof client.getServerStderr !== 'function') return;
    const stream = client.getServerStderr(serverName);
    if (!stream) return;

    let buffer = '';
    const lines = stderrLogs.get(serverName) ?? [];
    stderrLogs.set(serverName, lines);

    stream.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const parts = buffer.split('\n');
      // Last element is incomplete line (or empty if ended with \n)
      buffer = parts.pop()!;
      for (const line of parts) {
        if (line.trim()) {
          lines.push(line);
          if (lines.length > MAX_STDERR_LINES) {
            lines.shift();
          }
        }
      }
    });

    stream.on('end', () => {
      if (buffer.trim()) {
        lines.push(buffer);
        if (lines.length > MAX_STDERR_LINES) {
          lines.shift();
        }
      }
    });
  }

  function createOAuthProvider(name: string, cfg: McpHttpServerConfig) {
    if (!cfg.oauth) return undefined;

    return new MCPOAuthClientProvider({
      redirectUrl: cfg.oauth.redirectUrl,
      clientMetadata: {
        redirect_uris: [cfg.oauth.redirectUrl],
        client_name: cfg.oauth.clientName ?? `Mastra Code MCP ${name}`,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        ...(cfg.oauth.scopes?.length ? { scope: cfg.oauth.scopes.join(' ') } : {}),
      },
      clientInformation: cfg.oauth.clientId
        ? ({
            client_id: cfg.oauth.clientId,
            ...(cfg.oauth.clientSecret ? { client_secret: cfg.oauth.clientSecret } : {}),
          } satisfies OAuthClientInformation)
        : undefined,
      storage: new FileOAuthStorage(getOAuthStoragePath(projectDir, name, cfg)),
    });
  }

  function buildServerDefs(servers: Record<string, McpServerConfig>): Record<string, MastraMCPServerDefinition> {
    const defs: Record<string, MastraMCPServerDefinition> = {};
    for (const [name, cfg] of Object.entries(servers)) {
      if ('url' in cfg) {
        const httpCfg = cfg as McpHttpServerConfig;
        defs[name] = {
          url: new URL(httpCfg.url),
          requestInit: httpCfg.headers ? { headers: httpCfg.headers } : undefined,
          authProvider: createOAuthProvider(name, httpCfg),
        };
      } else {
        defs[name] = { command: cfg.command, args: cfg.args, env: cfg.env, stderr: 'pipe' };
      }
    }
    return defs;
  }

  async function connectAndCollectTools(): Promise<void> {
    const servers = config.mcpServers;
    if (!servers || Object.keys(servers).length === 0) {
      return;
    }

    // Pre-populate statuses as "connecting" so callers can see in-progress state
    const serverNames = Object.keys(servers);
    for (const name of serverNames) {
      serverStatuses.set(name, {
        name,
        connected: false,
        connecting: true,
        toolCount: 0,
        toolNames: [],
        transport: getTransport(servers[name]!),
      });
    }

    client = new MCPClient({
      id: 'mastra-code-mcp',
      servers: buildServerDefs(servers),
      timeout: MASTRACODE_MCP_TIMEOUT_MS,
    });

    // Use listToolsetsWithErrors() to get tools grouped by server name,
    // plus per-server error messages for servers that failed to connect.

    try {
      const { toolsets, errors } = await client.listToolsetsWithErrors();

      // Flatten toolsets into the namespaced tools map (serverName_toolName)
      for (const [serverName, serverTools] of Object.entries(toolsets)) {
        for (const [toolName, toolConfig] of Object.entries(serverTools)) {
          tools[`${serverName}_${toolName}`] = toolConfig;
        }
      }

      for (const name of serverNames) {
        const serverTools = toolsets[name];
        if (serverTools && Object.keys(serverTools).length > 0) {
          const toolNames = Object.keys(serverTools).map(t => `${name}_${t}`);
          serverStatuses.set(name, {
            name,
            connected: true,
            toolCount: toolNames.length,
            toolNames,
            transport: getTransport(servers[name]!),
          });
        } else {
          // Server failed — use the real error from listToolsetsWithErrors()
          serverStatuses.set(name, {
            name,
            connected: false,
            toolCount: 0,
            toolNames: [],
            transport: getTransport(servers[name]!),
            error: errors[name] ?? 'Failed to connect',
          });
        }
      }

      // Capture stderr from all stdio servers (connected or failed)
      for (const name of serverNames) {
        captureStderr(name);
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

    async initInBackground(): Promise<McpInitResult> {
      await this.init();
      const statuses = Array.from(serverStatuses.values());
      const connected = statuses.filter(s => s.connected);
      const failed = statuses.filter(s => !s.connected);
      return {
        connected,
        failed,
        skipped: [...(config.skippedServers ?? [])],
        totalTools: connected.reduce((sum, s) => sum + s.toolCount, 0),
      };
    },

    async reload() {
      await disconnect();
      config = applyExtraServers(loadMcpConfig(projectDir, configDirName));
      tools = {};
      serverStatuses = new Map();
      stderrLogs = new Map();
      initialized = false;
      await connectAndCollectTools();
      initialized = true;
    },

    async reconnectServer(name: string): Promise<McpServerStatus> {
      const cfg = config.mcpServers?.[name];
      if (!cfg) {
        return {
          name,
          connected: false,
          toolCount: 0,
          toolNames: [],
          transport: 'stdio',
          error: `Server "${name}" not found in config`,
        };
      }

      if (!client) {
        return {
          name,
          connected: false,
          toolCount: 0,
          toolNames: [],
          transport: getTransport(cfg),
          error: 'MCP client not initialized',
        };
      }

      const transport = getTransport(cfg);

      // Remove old tools for this server
      const prefix = `${name}_`;
      for (const key of Object.keys(tools)) {
        if (key.startsWith(prefix)) {
          delete tools[key];
        }
      }

      // Clear old logs and mark as connecting
      stderrLogs.delete(name);
      serverStatuses.set(name, {
        name,
        connected: false,
        connecting: true,
        toolCount: 0,
        toolNames: [],
        transport,
      });

      try {
        // Use MCPClient's per-server reconnect
        await client.reconnectServer(name);

        // Recapture stderr for the reconnected server
        captureStderr(name);

        // Fetch updated toolsets to get this server's tools
        const { toolsets, errors } = await client.listToolsetsWithErrors();
        const serverTools = toolsets[name];
        const serverError = errors[name];

        if (serverError) {
          const status: McpServerStatus = {
            name,
            connected: false,
            toolCount: 0,
            toolNames: [],
            transport,
            error: serverError,
          };
          serverStatuses.set(name, status);
          return status;
        } else if (serverTools && Object.keys(serverTools).length > 0) {
          const toolNames = Object.keys(serverTools).map(t => `${name}_${t}`);
          for (const [toolName, toolConfig] of Object.entries(serverTools)) {
            tools[`${name}_${toolName}`] = toolConfig;
          }
          const status: McpServerStatus = {
            name,
            connected: true,
            toolCount: toolNames.length,
            toolNames,
            transport,
          };
          serverStatuses.set(name, status);
          return status;
        } else {
          const status: McpServerStatus = {
            name,
            connected: false,
            toolCount: 0,
            toolNames: [],
            transport,
            error: 'Failed to connect',
          };
          serverStatuses.set(name, status);
          return status;
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        const status: McpServerStatus = {
          name,
          connected: false,
          toolCount: 0,
          toolNames: [],
          transport,
          error: errMsg,
        };
        serverStatuses.set(name, status);
        return status;
      }
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

    getServerLogs(name: string) {
      return [...(stderrLogs.get(name) ?? [])];
    },
  };
}
