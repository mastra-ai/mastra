import { createHash, randomUUID } from 'node:crypto';

import { getToolCategory } from '@mastra/code-sdk/permissions';
import { MC_TOOLS } from '@mastra/code-sdk/tool-names';
import type { Tool } from '@mastra/core/tools';
import { MCPClient, UnauthorizedError } from '@mastra/mcp';
import type { MastraMCPServerDefinition, MCPDiscoveryErrorDetails, SerializableMCPToolDefinition } from '@mastra/mcp';

import type { McpServerAuthType, McpServerRecord, McpServersStorage } from '../storage/domains/mcp-servers/base.js';
import { safeErrorText, describeOAuthErrorCode, findOAuthFailure } from './errors.js';
import { createMcpOAuthProvider } from './oauth.js';
import type { McpOAuthEndpoints } from './oauth.js';
import { MCP_SERVER_LIMITS } from './schemas.js';
import { McpServerNetworkPolicyError, createGuardedFetch } from './url-policy.js';
import type { GuardedFetch } from './url-policy.js';

const CONNECT_TIMEOUT_MS = 15_000;

export interface McpServersRuntimeOptions {
  storage: McpServersStorage;
  allowPrivateNetwork: boolean;
  /** OAuth callback and client metadata URLs; without them `oauth` servers connect unauthenticated. */
  oauthEndpoints?: McpOAuthEndpoints;
}

export type McpServerDiscoveryResult =
  | { status: 'connected'; tools: SerializableMCPToolDefinition[] }
  | { status: 'needs_auth' | 'error'; error: string };

export interface SkippedMcpServerTool {
  serverId: string;
  toolName: string;
  exposedName: string;
  reason: 'name_conflict' | 'reserved_name' | 'invalid_definition' | 'credentials_unreadable';
  /** Why the definition is invalid; contains no secrets. */
  detail?: string;
}

const BUILT_IN_TOOL_NAMES: ReadonlySet<string> = new Set(Object.values(MC_TOOLS));

/**
 * Names an MCP tool must never take, even when no tool has them this turn:
 * approval is decided by tool name, so taking a built-in's name (`web_search`,
 * `ask_user`) would also take its approval rule, and `factory_*` names are
 * allowed without approval on every Factory session.
 */
export function isReservedToolName(name: string): boolean {
  return getToolCategory(name) !== 'mcp' || BUILT_IN_TOOL_NAMES.has(name) || name.startsWith('factory_');
}

/**
 * Everything a server's connection is built from. A rename, a new tool
 * selection, or a refresh leaves it alone, so turns already using the
 * server's tools keep working through them.
 */
function connectionKey(record: McpServerRecord): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        record.slug,
        record.url,
        record.authType,
        Object.entries(record.headers ?? {}).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        record.oauthClientId,
        record.oauthClientSecret,
        record.oauthScopes,
        record.oauthGeneration,
        record.authorizationServerHosts,
      ]),
    )
    .digest('hex');
}

/** Whether an edit changed what the server's connection is built from. */
export function connectionChanged(before: McpServerRecord, after: McpServerRecord): boolean {
  return connectionKey(before) !== connectionKey(after);
}

interface CachedClient {
  orgId: string;
  key: string;
  client: MCPClient;
}

/**
 * Connects organization MCP servers. Discovery opens a short-lived client and
 * returns the server's tool definitions; sessions rebuild the selected tools
 * from the stored catalog without connecting, through one cached client per
 * server that connects lazily on the first tool call and is replaced whenever
 * the server's URL, authentication, or credentials change.
 */
export class McpServersRuntime {
  readonly #storage: McpServersStorage;
  readonly #oauthEndpoints: McpOAuthEndpoints | undefined;
  readonly #fetch: GuardedFetch;
  readonly #clients = new Map<string, CachedClient>();
  /**
   * Counts changes to this replica's connections. A read that began before a
   * server's connection last changed may hold an older version of the server
   * (or one since deleted), so it must neither rebuild nor release that
   * connection. Local and monotonic, unlike `updatedAt`, which another
   * replica's clock stamps.
   */
  #connectionChanges = 0;
  readonly #connectionChangedAt = new Map<string, number>();
  #closed = false;

  constructor({ storage, allowPrivateNetwork, oauthEndpoints }: McpServersRuntimeOptions) {
    this.#storage = storage;
    this.#oauthEndpoints = oauthEndpoints;
    this.#fetch = createGuardedFetch({ allowPrivateNetwork });
  }

  /**
   * `signedIn` attaches the OAuth provider (and its stored tokens). Without
   * tokens it is left off: the server's 401 then reads as "sign in", instead
   * of the SDK starting an authorization of its own.
   */
  #buildDefinition(
    record: McpServerRecord,
    { fetch = this.#fetch, signedIn }: { fetch?: GuardedFetch; signedIn: boolean },
  ): MastraMCPServerDefinition {
    const url = new URL(record.url);
    const authProvider =
      record.authType === 'oauth' && signedIn && this.#oauthEndpoints
        ? createMcpOAuthProvider(record, {
            storage: this.#storage,
            endpoints: this.#oauthEndpoints,
            forSessions: true,
          })
        : undefined;
    return {
      url,
      ...(record.authType === 'headers' && record.headers ? { requestInit: { headers: { ...record.headers } } } : {}),
      ...(authProvider ? { authProvider } : {}),
      fetch,
      // Redirects and token refreshes may only reach the server and the
      // authorization server hosts recorded by the last sign-in.
      allowedHosts: [url.host, ...record.authorizationServerHosts],
      connectTimeout: CONNECT_TIMEOUT_MS,
    };
  }

  /** Connect to the server and list its tools. Never throws; failures come back as a status and a safe message. */
  async discover(record: McpServerRecord): Promise<McpServerDiscoveryResult> {
    // Keep the guard's own message: it is precise and contains no secrets, and
    // the transport may wrap it beyond recognition.
    let policyError: McpServerNetworkPolicyError | undefined;
    const fetch: GuardedFetch = async (input, init) => {
      try {
        return await this.#fetch(input, init);
      } catch (error) {
        if (error instanceof McpServerNetworkPolicyError) policyError = error;
        throw error;
      }
    };
    const signedIn = record.authType === 'oauth' && (await this.#storage.hasOAuthTokens(record));
    const client = new MCPClient({
      id: `factory-mcp-discover:${record.id}:${randomUUID()}`,
      servers: { [record.slug]: this.#buildDefinition(record, { fetch, signedIn }) },
      registerProcessHooks: false,
    });
    try {
      const { definitions, errorDetails } = await client.listToolDefinitionsWithErrors();
      // Slugs and tool names are user/server supplied: `constructor` must not find `Object.prototype`.
      const failure = Object.hasOwn(errorDetails, record.slug) ? errorDetails[record.slug] : undefined;
      if (failure) return classifyFailure(record, failure, policyError);
      // A name longer than a tool selection may carry could never be chosen.
      const offered = Object.hasOwn(definitions, record.slug) ? definitions[record.slug] : undefined;
      const tools = Object.values(offered ?? {}).filter(tool => tool.name.length <= MCP_SERVER_LIMITS.toolNameLength);
      if (tools.length > MCP_SERVER_LIMITS.tools) {
        return {
          status: 'error',
          error: `The server offers ${tools.length} tools; at most ${MCP_SERVER_LIMITS.tools} are supported.`,
        };
      }
      if (Buffer.byteLength(JSON.stringify(tools)) > MCP_SERVER_LIMITS.catalogBytes) {
        return {
          status: 'error',
          error: `The server's tool descriptions are larger than the ${MCP_SERVER_LIMITS.catalogBytes / (1024 * 1024)} MB supported.`,
        };
      }
      return { status: 'connected', tools };
    } catch (error) {
      return classifyFailure(record, { message: error instanceof Error ? error.message : String(error) }, policyError);
    } finally {
      await client.disconnect().catch(() => undefined);
    }
  }

  /**
   * The selected tools of the organization's connected servers, keyed by
   * their exposed names. Tools whose name is already taken or reserved are
   * skipped and reported, never thrown, so one misconfigured server cannot
   * break a session.
   */
  async toolsFor({
    orgId,
    existingNames,
  }: {
    orgId: string;
    existingNames: ReadonlySet<string>;
  }): Promise<{ tools: Record<string, Tool<any, any, any, any>>; skipped: SkippedMcpServerTool[] }> {
    const readAt = this.#connectionChanges;
    const records = await this.#storage.list({ orgId });
    const tools: Record<string, Tool<any, any, any, any>> = {};
    const skipped: SkippedMcpServerTool[] = [];
    const taken = new Set(existingNames);
    const active = new Set<string>();

    for (const record of records) {
      if (record.status !== 'connected' || !record.toolCatalog || record.selectedTools.length === 0) continue;
      const catalog = record.toolCatalog;
      const entries = record.selectedTools.flatMap(toolName =>
        Object.hasOwn(catalog, toolName) ? [{ toolName, entry: catalog[toolName]! }] : [],
      );
      const skipServer = (reason: SkippedMcpServerTool['reason'], detail?: string) => {
        for (const { toolName, entry } of entries) {
          skipped.push({ serverId: record.id, toolName, exposedName: entry.exposedName, reason, detail });
        }
      };
      if (record.credentialsUnreadable) {
        skipServer('credentials_unreadable');
        continue;
      }
      active.add(record.id);
      let client: MCPClient | undefined;
      try {
        client = this.#clientFor(record, readAt);
      } catch (error) {
        // A server whose stored settings no longer make a connection costs only its own tools.
        skipServer('invalid_definition', safeErrorText(record, error instanceof Error ? error.message : String(error)));
        continue;
      }
      // Changed since this read began: the next turn gets its tools.
      if (!client) continue;
      for (const { toolName, entry } of entries) {
        const skip = (reason: SkippedMcpServerTool['reason'], detail?: string) => {
          skipped.push({ serverId: record.id, toolName, exposedName: entry.exposedName, reason, detail });
        };
        // One bad entry must not cost the organization every other server's tools.
        try {
          if (isReservedToolName(entry.exposedName)) {
            skip('reserved_name');
            continue;
          }
          if (taken.has(entry.exposedName)) {
            skip('name_conflict');
            continue;
          }
          const tool = await client.toolFromDefinition({ serverName: record.slug, definition: entry.definition });
          this.#guardTool(record, client, tool);
          tools[entry.exposedName] = tool;
          taken.add(entry.exposedName);
        } catch (error) {
          skip('invalid_definition', error instanceof Error ? error.message : String(error));
        }
      }
    }

    // Servers removed or disconnected (possibly by another replica) release their connection.
    for (const [serverId, cached] of this.#clients) {
      if (cached.orgId === orgId && !active.has(serverId) && !this.#changedSince(serverId, readAt)) {
        this.invalidate(serverId);
      }
    }
    return { tools, skipped };
  }

  /** Drop the cached connection for a server after it changes or is removed. */
  invalidate(serverId: string): void {
    this.#connectionChangedAt.set(serverId, ++this.#connectionChanges);
    const cached = this.#clients.get(serverId);
    if (!cached) return;
    this.#clients.delete(serverId);
    void cached.client.disconnect().catch(() => undefined);
  }

  async close(): Promise<void> {
    this.#closed = true;
    const clients = [...this.#clients.values()];
    this.#clients.clear();
    this.#connectionChangedAt.clear();
    await Promise.allSettled(clients.map(cached => cached.client.disconnect()));
  }

  /**
   * Calls only go through the server's current connection on this replica:
   * once the server's URL, authentication, or credentials change here, or it
   * is removed or signed out here, a tool a turn already holds refuses instead
   * of reconnecting with the old address and credentials. A change made on
   * another replica reaches this one's turns at their next `toolsFor`.
   *
   * A call the server refuses with a 401 means the saved credentials or tokens
   * stopped working (an OAuth refresh was already attempted): mark the server
   * as needing sign-in so sessions stop getting its tools.
   */
  #guardTool(record: McpServerRecord, client: MCPClient, tool: Tool<any, any, any, any>): void {
    const execute = tool.execute;
    if (!execute) return;
    const current = () => this.#clients.get(record.id)?.client === client;
    tool.execute = async (input, context) => {
      if (!current()) {
        throw new Error(
          `MCP server "${record.name}" was changed or removed after this turn started; its tools can no longer be called in this turn.`,
        );
      }
      try {
        return await execute(input, context);
      } catch (error) {
        const oauth = findOAuthFailure(error);
        if (isUnauthorized(error) || oauth?.signInAgain) {
          // Only the connection that was refused, checked before awaiting: a newer one has its own credentials.
          if (current()) this.invalidate(record.id);
          await this.#storage
            .setStatus({
              orgId: record.orgId,
              id: record.id,
              status: 'needs_auth',
              lastError: needsAuthMessage(record.authType),
              // A refusal of credentials an admin has since replaced (on any replica) says nothing about the new ones.
              // Any other edit since this turn's read also skips it; the next turn's refusal is recorded.
              ifUpdatedAt: record.updatedAt,
            })
            .catch(() => undefined);
        }
        // The authorization server's own text can echo tokens; keep it out of the session.
        if (oauth) throw new Error(`MCP server "${record.name}" sign-in failed: ${oauth.message}`);
        throw error;
      }
    };
  }

  #clientFor(record: McpServerRecord, readAt: number): MCPClient | undefined {
    const key = connectionKey(record);
    const cached = this.#clients.get(record.id);
    if (cached?.key === key) return cached.client;
    // Shut down (a connection made now would never be closed), or a read older than the connection's last change.
    if (this.#closed || this.#changedSince(record.id, readAt)) return undefined;
    // Disconnect first: it also removes the stale instance from MCPClient's id cache.
    if (cached) this.invalidate(record.id);
    const client = new MCPClient({
      id: `factory-mcp:${record.id}`,
      // Only connected servers reach here; an OAuth one has tokens.
      servers: { [record.slug]: this.#buildDefinition(record, { signedIn: true }) },
      registerProcessHooks: false,
    });
    this.#clients.set(record.id, { orgId: record.orgId, key, client });
    this.#connectionChangedAt.set(record.id, ++this.#connectionChanges);
    return client;
  }

  #changedSince(serverId: string, readAt: number): boolean {
    return (this.#connectionChangedAt.get(serverId) ?? 0) > readAt;
  }
}

/**
 * Turn a discovery failure into a status and a message safe to store and show:
 * known failures get a fixed explanation, anything else is reduced to its first
 * line with every configured secret removed.
 */
function classifyFailure(
  record: McpServerRecord,
  failure: MCPDiscoveryErrorDetails,
  policyError: McpServerNetworkPolicyError | undefined,
): Exclude<McpServerDiscoveryResult, { status: 'connected' }> {
  if (policyError) return { status: 'error', error: policyError.message };

  // OAuth error codes are lowercase (`invalid_grant`); MCP SDK and network codes are not.
  const oauth = describeOAuthErrorCode(failure.code);
  if (oauth) return { status: oauth.signInAgain ? 'needs_auth' : 'error', error: oauth.message };

  const message = failure.message;
  const code = typeof failure.code === 'string' ? failure.code.toUpperCase() : '';
  if (failure.httpStatus === 401 || /unauthori[sz]ed|\b401\b/i.test(message)) {
    return { status: 'needs_auth', error: needsAuthMessage(record.authType) };
  }
  if (failure.httpStatus === 403) {
    return {
      status: 'error',
      error: 'The server refused access (HTTP 403). Check the credentials and their permissions.',
    };
  }
  if (/allowedHosts policy/.test(message)) {
    return { status: 'error', error: "A request to a host other than the server's own was blocked." };
  }
  if (/^(ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ECONNRESET|EHOSTUNREACH|ENETUNREACH)$/.test(code)) {
    return { status: 'error', error: 'Could not reach the server. Check the URL and that the server is running.' };
  }
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed/i.test(message)) {
    return { status: 'error', error: 'Could not reach the server. Check the URL and that the server is running.' };
  }
  if (/timed? ?out/i.test(message)) {
    return { status: 'error', error: 'The server did not respond in time.' };
  }
  if (failure.httpStatus !== undefined) {
    return {
      status: 'error',
      error: `The server responded with HTTP ${failure.httpStatus}. Check that the URL points at an MCP endpoint.`,
    };
  }
  return { status: 'error', error: `Could not connect: ${safeErrorText(record, message)}` };
}

function needsAuthMessage(authType: McpServerAuthType): string {
  return authType === 'oauth'
    ? 'Sign in to connect this server.'
    : authType === 'headers'
      ? 'The server rejected the saved credentials (HTTP 401). Update the headers and connect again.'
      : 'The server requires authentication (HTTP 401).';
}

/** A transport-level 401, never an in-band tool error that merely mentions it. */
function isUnauthorized(error: unknown): boolean {
  for (let cause = error, depth = 0; cause && depth < 8; cause = (cause as { cause?: unknown }).cause, depth++) {
    if (cause instanceof UnauthorizedError || (cause as { status?: unknown }).status === 401) return true;
  }
  return false;
}
