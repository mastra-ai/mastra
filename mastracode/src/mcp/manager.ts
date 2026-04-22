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
const OAUTH_TIMEOUT_ERROR = 'OAuth authorization timed out';
const OAUTH_SUCCESS_HTML =
  '<html><body><h2>Authorization successful.</h2><p>You can close this tab.</p></body></html>';

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
  arm(expectedState: string): void;
  reset(): void;
  waitForCode(): Promise<OAuthCallbackResult | null>;
  close(): void;
}

interface OAuthCallbackResult {
  code: string;
  state: string;
}

function getTransport(cfg: McpServerConfig): 'stdio' | 'http' {
  return 'url' in cfg ? 'http' : 'stdio';
}

function openBrowser(url: string): void {
  if (process.platform === 'darwin') {
    exec(`open '${url.replace(/'/g, "'\\''")}'`);
  } else if (process.platform === 'win32') {
    exec(`start "" "${url}"`);
  } else {
    // On WSL, wslview and cmd.exe break URLs with & query params.
    // PowerShell handles them correctly via Start-Process.
    const psEscaped = url.replace(/'/g, "''");
    exec(
      `powershell.exe -NoProfile -Command "Start-Process '${psEscaped}'" 2>/dev/null || xdg-open '${url.replace(/'/g, "'\\''")}'`,
    );
  }
}

function startOAuthCallbackServer(): Promise<OAuthCallbackServer> {
  return new Promise((resolve, reject) => {
    let expectedState: string | null = null;
    let callbackResult: OAuthCallbackResult | null = null;
    let cancelled = false;

    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '', `http://localhost`);
      if (url.pathname !== OAUTH_CALLBACK_PATH) {
        res.writeHead(404);
        res.end();
        return;
      }

      if (!expectedState) {
        res.writeHead(409);
        res.end('No OAuth authorization is pending');
        return;
      }

      const code = url.searchParams.get('code');
      if (!code) {
        res.writeHead(400);
        res.end('Missing authorization code');
        return;
      }

      const state = url.searchParams.get('state');
      if (!state) {
        res.writeHead(400);
        res.end('Missing OAuth state');
        return;
      }

      if (state !== expectedState) {
        res.writeHead(400);
        res.end('State mismatch');
        return;
      }

      callbackResult = { code, state };
      expectedState = null;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(OAUTH_SUCCESS_HTML);
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
        arm(state) {
          callbackResult = null;
          expectedState = state;
        },
        reset() {
          callbackResult = null;
          expectedState = null;
        },
        async waitForCode() {
          const interval = 100;
          const iterations = OAUTH_CALLBACK_TIMEOUT_MS / interval;
          for (let i = 0; i < iterations; i++) {
            if (callbackResult) return callbackResult;
            if (cancelled) return null;
            await new Promise(r => setTimeout(r, interval));
          }
          return null;
        },
        close() {
          cancelled = true;
          callbackResult = null;
          expectedState = null;
          server.close();
        },
      });
    });

    server.on('error', reject);
  });
}

interface OAuthSession {
  callbackServer: OAuthCallbackServer;
  currentState: string | null;
  redirectTriggered: boolean;
  provider: MCPOAuthClientProvider;
  serverName: string;
  serverUrl: URL;
}

async function createOAuthSession(serverName: string, dataDir: string, serverUrl: URL): Promise<OAuthSession> {
  const callbackServer = await startOAuthCallbackServer();
  const storagePath = join(dataDir, 'mcp-oauth.json');
  const storage = new McpOAuthFileStorage(serverName, storagePath);
  const redirectUrl = `http://localhost:${callbackServer.port}${OAUTH_CALLBACK_PATH}`;
  const session: OAuthSession = {
    callbackServer,
    currentState: null,
    redirectTriggered: false,
    provider: null as unknown as MCPOAuthClientProvider,
    serverName,
    serverUrl,
  };

  session.provider = new MCPOAuthClientProvider({
    redirectUrl,
    clientMetadata: {
      redirect_uris: [redirectUrl],
      client_name: `mastracode (${serverName})`,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    },
    storage,
    stateGenerator: () => {
      const state = crypto.randomUUID();
      session.currentState = state;
      return state;
    },
    onRedirectToAuthorization: (url: URL) => {
      if (!session.currentState) {
        throw new Error(`OAuth state was not initialized for server "${serverName}"`);
      }
      session.redirectTriggered = true;
      session.callbackServer.arm(session.currentState);
      openBrowser(url.toString());
    },
  });
  return session;
}

async function buildServerDefs(
  servers: Record<string, McpServerConfig>,
  dataDir: string,
): Promise<{ defs: Record<string, MastraMCPServerDefinition>; oauthSessions: Map<string, OAuthSession> }> {
  const defs: Record<string, MastraMCPServerDefinition> = {};
  const oauthSessions = new Map<string, OAuthSession>();

  for (const [name, cfg] of Object.entries(servers)) {
    if ('url' in cfg) {
      const httpCfg = cfg as McpHttpServerConfig;
      const def: MastraMCPServerDefinition = {
        url: new URL(httpCfg.url),
        requestInit: httpCfg.headers ? { headers: httpCfg.headers } : undefined,
      };
      if (httpCfg.auth === 'oauth') {
        const oauthSession = await createOAuthSession(name, dataDir, def.url as URL);
        def.authProvider = oauthSession.provider;
        oauthSessions.set(name, oauthSession);
      }
      defs[name] = def;
    } else {
      defs[name] = { command: cfg.command, args: cfg.args, env: cfg.env, stderr: 'pipe' };
    }
  }

  return { defs, oauthSessions };
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
  let oauthSessions = new Map<string, OAuthSession>();
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

  function setOAuthServerError(name: string, error: string): void {
    const cfg = config.mcpServers?.[name];
    if (!cfg) return;

    serverStatuses.set(name, {
      name,
      connected: false,
      toolCount: 0,
      toolNames: [],
      transport: getTransport(cfg),
      error,
    });
  }

  async function completePendingOAuthAuthorizations(targetNames?: Set<string>): Promise<boolean> {
    let authorizedAny = false;

    for (const [name, session] of oauthSessions) {
      if (targetNames && !targetNames.has(name)) continue;
      if (!session.redirectTriggered) continue;

      const callbackResult = await session.callbackServer.waitForCode();
      session.redirectTriggered = false;
      session.currentState = null;
      session.callbackServer.reset();

      if (!callbackResult) {
        setOAuthServerError(name, OAUTH_TIMEOUT_ERROR);
        continue;
      }

      try {
        await auth(session.provider, {
          serverUrl: session.serverUrl,
          authorizationCode: callbackResult.code,
        });
        authorizedAny = true;
      } catch (error) {
        setOAuthServerError(name, error instanceof Error ? error.message : String(error));
      }
    }

    return authorizedAny;
  }

  async function connectAndCollectTools(): Promise<void> {
    const servers = config.mcpServers;
    if (!servers || Object.keys(servers).length === 0) {
      return;
    }

    const initialBuild = await buildServerDefs(servers, resolvedDataDir);
    oauthSessions = initialBuild.oauthSessions;

    try {
      await tryConnect(servers, initialBuild.defs);
    } catch {
      // tryConnect sets statuses on failure — continue to check for auth redirect
    }

    const didAuthorize = await completePendingOAuthAuthorizations();
    if (!didAuthorize) {
      return;
    }

    await safeDisconnect();
    serverStatuses = new Map();
    tools = {};

    const retryBuild = await buildServerDefs(servers, resolvedDataDir);
    oauthSessions = retryBuild.oauthSessions;

    try {
      await tryConnect(servers, retryBuild.defs);
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

    for (const session of oauthSessions.values()) {
      session.callbackServer.close();
    }
    oauthSessions = new Map();
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
      const activeClient = client;

      const attemptReconnect = async (): Promise<McpServerStatus> => {
        const prefix = `${name}_`;
        for (const key of Object.keys(tools)) {
          if (key.startsWith(prefix)) {
            delete tools[key];
          }
        }

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
          await activeClient.reconnectServer(name);
          captureStderr(name);

          const { toolsets, errors } = await activeClient.listToolsetsWithErrors();
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
      };

      const initialStatus = await attemptReconnect();
      const didAuthorize = await completePendingOAuthAuthorizations(new Set([name]));
      if (!didAuthorize) {
        return serverStatuses.get(name) ?? initialStatus;
      }

      return attemptReconnect();
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
