/**
 * MCP manager — orchestrates MCP server connections using MCPClient directly.
 * Created once at startup, provides tools from connected MCP servers.
 */

import { exec } from 'node:child_process';
import http from 'node:http';
import { join } from 'node:path';
import { MCPClient, MCPOAuthClientProvider, auth } from '@mastra/mcp';
import type { MastraMCPServerDefinition } from '@mastra/mcp';
import { loadMcpConfig, getProjectMcpPath, getGlobalMcpPath, getClaudeSettingsPath } from './config.js';
import { McpOAuthFileStorage } from './mcp-oauth-storage.js';
import type { McpConfig, McpHttpServerConfig, McpServerConfig, McpServerStatus, McpSkippedServer } from './types.js';

const MASTRACODE_MCP_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const OAUTH_CALLBACK_PATH = '/oauth/callback';
const OAUTH_CALLBACK_TIMEOUT_MS = 120_000;

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

interface OAuthCallbackServer {
  port: number;
  waitForCode(): Promise<string | null>;
  close(): void;
}

function getTransport(cfg: McpServerConfig): 'stdio' | 'http' {
  return 'url' in cfg ? 'http' : 'stdio';
}

function openBrowser(url: string): void {
  if (process.platform === 'darwin') {
    exec(`open "${url}"`);
  } else if (process.platform === 'win32') {
    exec(`start "${url}"`);
  } else {
    exec(`wslview "${url}" 2>/dev/null || xdg-open "${url}" 2>/dev/null || cmd.exe /c start "${url}"`);
  }
}

function startOAuthCallbackServer(): Promise<OAuthCallbackServer> {
  return new Promise((resolve, reject) => {
    let receivedCode: string | null = null;
    let cancelled = false;

    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '', `http://localhost`);
      if (url.pathname !== OAUTH_CALLBACK_PATH) {
        res.writeHead(404);
        res.end();
        return;
      }

      const code = url.searchParams.get('code');
      if (!code) {
        res.writeHead(400);
        res.end('Missing authorization code');
        return;
      }

      receivedCode = code;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<html><body><h2>Authorization successful.</h2><p>You can close this tab.</p></body></html>');
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      if (!port) {
        server.close();
        reject(new Error('Failed to bind OAuth callback server'));
        return;
      }

      resolve({
        port,
        async waitForCode() {
          const interval = 100;
          const iterations = OAUTH_CALLBACK_TIMEOUT_MS / interval;
          for (let i = 0; i < iterations; i++) {
            if (receivedCode) return receivedCode;
            if (cancelled) return null;
            await new Promise(r => setTimeout(r, interval));
          }
          return null;
        },
        close() {
          cancelled = true;
          server.close();
        },
      });
    });

    server.on('error', reject);
  });
}

interface OAuthContext {
  callbackServer: OAuthCallbackServer;
  redirectTriggered: boolean;
}

function createOAuthProvider(
  serverName: string,
  dataDir: string,
  oauthCtx: OAuthContext,
): MCPOAuthClientProvider {
  const storagePath = join(dataDir, 'mcp-oauth.json');
  const storage = new McpOAuthFileStorage(serverName, storagePath);
  const redirectUrl = `http://localhost:${oauthCtx.callbackServer.port}${OAUTH_CALLBACK_PATH}`;

  return new MCPOAuthClientProvider({
    redirectUrl,
    clientMetadata: {
      redirect_uris: [redirectUrl],
      client_name: `mastracode (${serverName})`,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    },
    storage,
    onRedirectToAuthorization: (url: URL) => {
      oauthCtx.redirectTriggered = true;
      openBrowser(url.toString());
    },
  });
}

function hasOAuthServers(servers: Record<string, McpServerConfig>): boolean {
  return Object.values(servers).some(cfg => 'url' in cfg && (cfg as McpHttpServerConfig).auth === 'oauth');
}

async function buildServerDefs(
  servers: Record<string, McpServerConfig>,
  dataDir: string,
): Promise<{ defs: Record<string, MastraMCPServerDefinition>; oauthCtx: OAuthContext | null }> {
  const defs: Record<string, MastraMCPServerDefinition> = {};
  let oauthCtx: OAuthContext | null = null;

  if (hasOAuthServers(servers)) {
    oauthCtx = {
      callbackServer: await startOAuthCallbackServer(),
      redirectTriggered: false,
    };
  }

  for (const [name, cfg] of Object.entries(servers)) {
    if ('url' in cfg) {
      const httpCfg = cfg as McpHttpServerConfig;
      const def: MastraMCPServerDefinition = {
        url: new URL(httpCfg.url),
        requestInit: httpCfg.headers ? { headers: httpCfg.headers } : undefined,
      };
      if (httpCfg.auth === 'oauth' && oauthCtx) {
        def.authProvider = createOAuthProvider(name, dataDir, oauthCtx);
      }
      defs[name] = def;
    } else {
      defs[name] = { command: cfg.command, args: cfg.args, env: cfg.env, stderr: 'pipe' };
    }
  }

  return { defs, oauthCtx };
}

/**
 * Create an MCP manager that wraps MCPClient with config-file discovery
 * and per-server status tracking.
 */
export function createMcpManager(
  projectDir: string,
  extraServers?: Record<string, McpServerConfig>,
  dataDir?: string,
): McpManager {
  /** Merge programmatic servers into a base config (highest priority). */
  const applyExtraServers = (base: McpConfig): McpConfig => {
    if (!extraServers || Object.keys(extraServers).length === 0) return base;
    return { ...base, mcpServers: { ...base.mcpServers, ...extraServers } };
  };

  const resolvedDataDir = dataDir ?? join(projectDir, '.mastracode');
  let config = applyExtraServers(loadMcpConfig(projectDir));
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

  async function tryConnect(
    servers: Record<string, McpServerConfig>,
    defs: Record<string, MastraMCPServerDefinition>,
  ): Promise<void> {
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
      servers: defs,
      timeout: MASTRACODE_MCP_TIMEOUT_MS,
    });

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

      throw error;
    }
  }

  async function connectAndCollectTools(): Promise<void> {
    const servers = config.mcpServers;
    if (!servers || Object.keys(servers).length === 0) {
      return;
    }

    const { defs, oauthCtx } = await buildServerDefs(servers, resolvedDataDir);

    try {
      await tryConnect(servers, defs);
    } catch {
      // tryConnect sets statuses on failure — continue to check for auth redirect
    }

    if (!oauthCtx?.redirectTriggered) {
      oauthCtx?.callbackServer.close();
      return;
    }

    const code = await oauthCtx.callbackServer.waitForCode();
    oauthCtx.callbackServer.close();

    if (!code) return;

    for (const [, def] of Object.entries(defs)) {
      if (!def.authProvider) continue;
      try {
        await auth(def.authProvider, {
          serverUrl: def.url as URL,
          authorizationCode: code,
        });
      } catch {
        // Token exchange failed — continue with others
      }
    }

    await safeDisconnect();
    serverStatuses = new Map();
    tools = {};

    try {
      await tryConnect(servers, defs);
    } catch {
      // Retry failed — statuses already set by tryConnect
    }
  }

  async function safeDisconnect(): Promise<void> {
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
      await safeDisconnect();
      config = applyExtraServers(loadMcpConfig(projectDir));
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

    disconnect: safeDisconnect,

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

    getServerLogs(name: string) {
      return [...(stderrLogs.get(name) ?? [])];
    },
  };
}
