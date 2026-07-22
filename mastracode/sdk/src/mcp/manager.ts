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
import {
  DEFAULT_OAUTH_REDIRECT_URL,
  loadMcpConfig,
  getProjectMcpPath,
  getGlobalMcpPath,
  getClaudeSettingsPath,
  resolveOAuthRedirectUrl,
} from './config.js';
import type {
  McpConfig,
  McpHttpOAuthConfig,
  McpHttpServerConfig,
  McpServerConfig,
  McpServerStatus,
  McpSkippedServer,
} from './types.js';

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
  /**
   * Run the OAuth authorization-code flow for an HTTP server, then reconnect it.
   * Servers without an `oauth` config are provisioned with a zero-config default
   * (dynamic client registration). The authorization URL is surfaced through
   * `onAuthorizationUrl` for the caller to open in a browser.
   *
   * Resolves with the resulting {@link McpServerStatus}: a connected status on
   * success, or a status carrying an `error` message on failure (including
   * cancellation) — it does not reject. Inspect the returned status rather than
   * relying on a thrown error.
   */
  authenticateServer(
    name: string,
    options?: { onAuthorizationUrl?: (url: string) => void; timeoutMs?: number },
  ): Promise<McpServerStatus>;
  /**
   * Cancel a pending {@link authenticateServer} flow for a server (e.g. the
   * user closed the browser without completing consent). The pending
   * authenticate call rejects and the server returns to the `needsAuth` state
   * so it can be retried. Returns `true` if a flow was cancelled.
   */
  cancelServerAuthentication(name: string): Promise<boolean>;
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

/**
 * Zero-config OAuth defaults for servers with a bare `url` entry. Dynamic
 * client registration provisions the client, so no `clientId` is needed.
 */
const DEFAULT_OAUTH_CONFIG: McpHttpOAuthConfig = { redirectUrl: DEFAULT_OAUTH_REDIRECT_URL };

function getOAuthStoragePath(projectDir: string, name: string, cfg: McpHttpServerConfig): string {
  // The fingerprint always uses the resolved redirect URL so a bare `url`
  // entry keeps the same token file before and after zero-config provisioning.
  const key = JSON.stringify({
    projectDir,
    name,
    url: cfg.url,
    redirectUrl: resolveOAuthRedirectUrl(cfg.oauth),
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
  let serverDefs: Record<string, MastraMCPServerDefinition> = {};
  let tools: Record<string, any> = {};
  let serverStatuses = new Map<string, McpServerStatus>();
  let stderrLogs = new Map<string, string[]>();
  let initialized = false;

  /** Per-server handlers that receive the OAuth authorization URL during authenticateServer(). */
  const authUrlHandlers = new Map<string, (url: string) => void>();

  /**
   * Servers with an OAuth authorization flow currently in flight. Owned by the
   * manager (not the TUI) so the state survives a `/mcp` selector being closed
   * and reopened — the reopened selector reads it back off the server status and
   * can still offer "Cancel authentication".
   */
  const authenticatingServers = new Set<string>();

  /**
   * Servers whose in-flight authentication was cancelled by the caller. Set by
   * cancelServerAuthentication() so the resolving authenticateServer() call can
   * mark its failed status as a deliberate cancel rather than a genuine failure.
   * This lives on the manager (not the TUI selector) so the signal survives the
   * selector being closed and reopened mid-flow.
   */
  const cancelledAuthServers = new Set<string>();

  /** Overlay the manager-owned `authenticating` flag onto a status snapshot. */
  const withAuthenticating = (status: McpServerStatus): McpServerStatus =>
    authenticatingServers.has(status.name) ? { ...status, authenticating: true } : status;

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
    // Bare `url` entries get no eager provider — auth is provisioned lazily
    // when the user authenticates — unless a previous session already stored
    // OAuth state for this server, in which case the provider is needed to
    // attach the persisted tokens on connect.
    const oauth =
      cfg.oauth ?? (existsSync(getOAuthStoragePath(projectDir, name, cfg)) ? DEFAULT_OAUTH_CONFIG : undefined);
    if (!oauth) return undefined;

    // redirectUrl is optional in the user-supplied config; resolve the stable
    // default (or the `callbackPort` shorthand, for programmatically registered
    // servers that bypass config parsing) so provider metadata always carries
    // a concrete URL.
    const redirectUrl = resolveOAuthRedirectUrl(oauth);

    return new MCPOAuthClientProvider({
      redirectUrl,
      clientMetadata: {
        redirect_uris: [redirectUrl],
        client_name: oauth.clientName ?? `Mastra Code MCP ${name}`,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        ...(oauth.scopes?.length ? { scope: oauth.scopes.join(' ') } : {}),
      },
      clientInformation: oauth.clientId
        ? ({
            client_id: oauth.clientId,
            ...(oauth.clientSecret ? { client_secret: oauth.clientSecret } : {}),
          } satisfies OAuthClientInformation)
        : undefined,
      storage: new FileOAuthStorage(getOAuthStoragePath(projectDir, name, cfg)),
      onRedirectToAuthorization: url => {
        authUrlHandlers.get(name)?.(url.toString());
      },
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

    serverDefs = buildServerDefs(servers);
    client = new MCPClient({
      id: 'mastra-code-mcp',
      servers: serverDefs,
      timeout: MASTRACODE_MCP_TIMEOUT_MS,
    });

    // Use listToolsetsWithErrors() to get tools grouped by server name,
    // plus per-server error messages for servers that failed to connect.

    try {
      const { toolsets, errors } = await client.listToolsetsWithErrors();
      const typedToolsets = toolsets as Record<string, Record<string, any>>;

      // Flatten toolsets into the namespaced tools map (serverName_toolName)
      for (const [serverName, serverTools] of Object.entries(typedToolsets)) {
        for (const [toolName, toolConfig] of Object.entries(serverTools)) {
          tools[`${serverName}_${toolName}`] = toolConfig;
        }
      }

      for (const name of serverNames) {
        const serverTools = typedToolsets[name];
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
          const error = errors[name] ?? 'Failed to connect';
          serverStatuses.set(name, {
            name,
            connected: false,
            toolCount: 0,
            toolNames: [],
            transport: getTransport(servers[name]!),
            error,
            ...(serverNeedsAuth(name, servers[name]!, error) ? { needsAuth: true } : {}),
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
          ...(serverNeedsAuth(name, servers[name]!, errMsg) ? { needsAuth: true } : {}),
        });
      }
    }
  }

  /**
   * Whether a failed HTTP server is blocked on OAuth authorization.
   *
   * Provider-backed servers report the exact state tracked by `@mastra/mcp`.
   * Bare `url` entries carry no provider until the user authenticates, so the
   * signal is a 401 in the connect error — surfaced either as the status text
   * or as the RFC 6750 `invalid_token` bearer error code in the response body.
   */
  function serverNeedsAuth(name: string, cfg: McpServerConfig, error?: string): boolean {
    if (getTransport(cfg) !== 'http') return false;
    if (client?.getServerAuthState?.(name) === 'needs-auth') return true;
    if (serverDefs[name]?.authProvider) return false;
    return error !== undefined && /\b401\b|unauthorized|invalid_token/i.test(error);
  }

  /**
   * Runs a single-server connect action (reconnect or authenticate), then
   * refreshes that server's tools and status from the client.
   */
  async function connectSingleServer(
    name: string,
    cfg: McpServerConfig,
    connect: () => Promise<unknown>,
  ): Promise<McpServerStatus> {
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
      await connect();

      // Recapture stderr for the reconnected server
      captureStderr(name);

      // Fetch updated toolsets to get this server's tools
      const { toolsets, errors } = await client!.listToolsetsWithErrors();
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
          ...(serverNeedsAuth(name, cfg, serverError) ? { needsAuth: true } : {}),
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
        ...(serverNeedsAuth(name, cfg, errMsg) ? { needsAuth: true } : {}),
      };
      serverStatuses.set(name, status);
      return status;
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

      // Use MCPClient's per-server reconnect
      return connectSingleServer(name, cfg, () => client!.reconnectServer(name));
    },

    async authenticateServer(
      name: string,
      options?: { onAuthorizationUrl?: (url: string) => void; timeoutMs?: number },
    ): Promise<McpServerStatus> {
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

      if (getTransport(cfg) !== 'http') {
        return {
          name,
          connected: false,
          toolCount: 0,
          toolNames: [],
          transport: 'stdio',
          error: `Server "${name}" uses stdio transport, which does not support OAuth`,
        };
      }

      // Zero-config provisioning: a bare `url` entry gets a provider with the
      // default redirect URL the first time the user authenticates. Dynamic
      // client registration takes care of the client credentials.
      //
      // NOTE: `serverDefs[name]` is the same object reference the MCPClient was
      // constructed with, and connectHttp reads `authProvider` live off it at
      // connect time, so mutating it here reaches the already-created client.
      // If MCPClient ever defensively copies its server config, zero-config auth
      // would need an explicit "set this server's provider" API instead.
      const def = serverDefs[name];
      if (def?.url && !def.authProvider) {
        def.authProvider = createOAuthProvider(name, { ...(cfg as McpHttpServerConfig), oauth: DEFAULT_OAUTH_CONFIG });
      }

      // Reject a concurrent second attempt for the same server. authUrlHandlers
      // has a single slot per server, so a second call with an onAuthorizationUrl
      // would overwrite the first caller's handler (which then never sees the
      // URL) and its finally would delete the handler out from under the other
      // in-flight call. Gate on authenticatingServers rather than authUrlHandlers
      // so callers without a URL handler are caught too. The underlying
      // client.authenticate already coalesces same-server calls into one flow.
      if (authenticatingServers.has(name)) {
        const current = serverStatuses.get(name);
        return {
          name,
          connected: current?.connected ?? false,
          connecting: current?.connecting,
          needsAuth: current?.needsAuth,
          toolCount: current?.toolCount ?? 0,
          toolNames: current?.toolNames ?? [],
          transport: current?.transport ?? getTransport(cfg),
          error: `Authentication for "${name}" is already in progress`,
        };
      }

      if (options?.onAuthorizationUrl) {
        authUrlHandlers.set(name, options.onAuthorizationUrl);
      }
      authenticatingServers.add(name);
      cancelledAuthServers.delete(name);
      try {
        const result = await connectSingleServer(name, cfg, () =>
          client!.authenticate(name, options?.timeoutMs === undefined ? undefined : { timeoutMs: options.timeoutMs }),
        );
        // A cancelled flow resolves with a failed status; mark it so callers can
        // distinguish a deliberate cancel from a genuine authentication failure.
        // Write the marker back to the durable status map (not just the returned
        // value) so a selector reopened after cancellation still sees it.
        const finalStatus =
          cancelledAuthServers.has(name) && !result.connected ? { ...result, cancelled: true } : result;
        serverStatuses.set(name, finalStatus);
        return finalStatus;
      } finally {
        authUrlHandlers.delete(name);
        authenticatingServers.delete(name);
        cancelledAuthServers.delete(name);
      }
    },

    async cancelServerAuthentication(name: string): Promise<boolean> {
      if (!client) {
        return false;
      }
      // Record the intent before aborting so the resolving authenticateServer()
      // call can tag its failed status as cancelled rather than failed.
      cancelledAuthServers.add(name);
      const cancelled = await client.cancelAuthentication(name);
      if (!cancelled) {
        cancelledAuthServers.delete(name);
      }
      return cancelled;
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
      return Array.from(serverStatuses.values(), withAuthenticating);
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
