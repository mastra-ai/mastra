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

const OAUTH_CALLBACK_PATH = '/oauth/callback';
const OAUTH_CALLBACK_TIMEOUT_MS = 120_000;

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
      defs[name] = { command: cfg.command, args: cfg.args, env: cfg.env };
    }
  }

  return { defs, oauthCtx };
}

/**
 * Create an MCP manager that wraps MCPClient with config-file discovery
 * and per-server status tracking.
 */
export function createMcpManager(projectDir: string, dataDir?: string): McpManager {
  const resolvedDataDir = dataDir ?? join(projectDir, '.mastracode');
  let config = loadMcpConfig(projectDir);
  let client: MCPClient | null = null;
  let tools: Record<string, any> = {};
  let serverStatuses = new Map<string, McpServerStatus>();
  let initialized = false;

  async function tryConnect(
    servers: Record<string, McpServerConfig>,
    defs: Record<string, MastraMCPServerDefinition>,
  ): Promise<void> {
    client = new MCPClient({ id: 'mastra-code-mcp', servers: defs });
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

    async reload() {
      await safeDisconnect();
      config = loadMcpConfig(projectDir);
      tools = {};
      serverStatuses = new Map();
      initialized = false;
      await connectAndCollectTools();
      initialized = true;
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
  };
}
