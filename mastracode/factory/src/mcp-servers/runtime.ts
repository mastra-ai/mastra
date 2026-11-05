import { randomUUID } from 'node:crypto';

import type { Tool } from '@mastra/core/tools';
import { MCPClient } from '@mastra/mcp';
import type {
  MastraMCPServerDefinition,
  MCPDiscoveryErrorDetails,
  MCPOAuthClientProvider,
  SerializableMCPToolDefinition,
} from '@mastra/mcp';

import type { McpServerRecord, McpServersStorage } from '../storage/domains/mcp-servers/base.js';
import { MCP_SERVER_LIMITS } from './schemas.js';
import { McpServerNetworkPolicyError, createGuardedFetch } from './url-policy.js';
import type { GuardedFetch } from './url-policy.js';

const CONNECT_TIMEOUT_MS = 15_000;
const MAX_ERROR_LENGTH = 300;

export interface McpServersRuntimeOptions {
  storage: McpServersStorage;
  allowPrivateNetwork: boolean;
  /** OAuth client provider for `oauth` servers; servers without one connect unauthenticated. */
  oauthProvider?: (record: McpServerRecord) => MCPOAuthClientProvider | undefined;
}

export type McpServerDiscoveryResult =
  | { status: 'connected'; tools: SerializableMCPToolDefinition[] }
  | { status: 'needs_auth' | 'error'; error: string };

export interface SkippedMcpServerTool {
  serverId: string;
  toolName: string;
  exposedName: string;
  reason: 'name_conflict' | 'invalid_definition';
}

interface CachedClient {
  orgId: string;
  updatedAt: number;
  client: MCPClient;
}

/**
 * Connects organization MCP servers. Discovery opens a short-lived client and
 * returns the server's tool definitions; sessions rebuild the selected tools
 * from the stored catalog without connecting, through one cached client per
 * server that connects lazily on the first tool call and is replaced whenever
 * the server row changes.
 */
export class McpServersRuntime {
  readonly #storage: McpServersStorage;
  readonly #oauthProvider: McpServersRuntimeOptions['oauthProvider'];
  readonly #fetch: GuardedFetch;
  readonly #clients = new Map<string, CachedClient>();

  constructor({ storage, allowPrivateNetwork, oauthProvider }: McpServersRuntimeOptions) {
    this.#storage = storage;
    this.#oauthProvider = oauthProvider;
    this.#fetch = createGuardedFetch({ allowPrivateNetwork });
  }

  buildDefinition(record: McpServerRecord, fetch: GuardedFetch = this.#fetch): MastraMCPServerDefinition {
    const url = new URL(record.url);
    return {
      url,
      ...(record.authType === 'headers' && record.headers ? { requestInit: { headers: { ...record.headers } } } : {}),
      ...(record.authType === 'oauth' ? { authProvider: this.#oauthProvider?.(record) } : {}),
      fetch,
      // Redirects, OAuth discovery, and token requests may only reach the server
      // and the authorization server recorded when sign-in started.
      allowedHosts: [url.host, ...(record.authorizationServerHost ? [record.authorizationServerHost] : [])],
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
    const client = new MCPClient({
      id: `factory-mcp-discover:${record.id}:${randomUUID()}`,
      servers: { [record.slug]: this.buildDefinition(record, fetch) },
      registerProcessHooks: false,
    });
    try {
      const { definitions, errorDetails } = await client.listToolDefinitionsWithErrors();
      const failure = errorDetails[record.slug];
      if (failure) return classifyFailure(record, failure, policyError);
      const tools = Object.values(definitions[record.slug] ?? {});
      if (tools.length > MCP_SERVER_LIMITS.tools) {
        return {
          status: 'error',
          error: `The server offers ${tools.length} tools; at most ${MCP_SERVER_LIMITS.tools} are supported.`,
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
   * their exposed names. Tools whose name is already taken are skipped, never
   * thrown, so one misconfigured server cannot break a session.
   */
  async toolsFor({
    orgId,
    existingNames,
  }: {
    orgId: string;
    existingNames: ReadonlySet<string>;
  }): Promise<{ tools: Record<string, Tool<any, any, any, any>>; skipped: SkippedMcpServerTool[] }> {
    const records = await this.#storage.list({ orgId });
    const tools: Record<string, Tool<any, any, any, any>> = {};
    const skipped: SkippedMcpServerTool[] = [];
    const taken = new Set(existingNames);
    const active = new Set<string>();

    for (const record of records) {
      if (record.status !== 'connected' || !record.toolCatalog || record.selectedTools.length === 0) continue;
      active.add(record.id);
      const client = this.#clientFor(record);
      for (const toolName of record.selectedTools) {
        const entry = record.toolCatalog[toolName];
        if (!entry) continue;
        const skip = (reason: SkippedMcpServerTool['reason'], detail: string) => {
          skipped.push({ serverId: record.id, toolName, exposedName: entry.exposedName, reason });
          console.warn(`[factory] skipping MCP tool "${entry.exposedName}" from server "${record.slug}": ${detail}`);
        };
        if (taken.has(entry.exposedName)) {
          skip('name_conflict', 'another tool already uses this name');
          continue;
        }
        try {
          tools[entry.exposedName] = await client.toolFromDefinition({
            serverName: record.slug,
            definition: entry.definition,
          });
          taken.add(entry.exposedName);
        } catch (error) {
          skip('invalid_definition', error instanceof Error ? error.message : String(error));
        }
      }
    }

    // Servers removed or disconnected (possibly by another replica) release their connection.
    for (const [serverId, cached] of this.#clients) {
      if (cached.orgId === orgId && !active.has(serverId)) this.invalidate(serverId);
    }
    return { tools, skipped };
  }

  /** Drop the cached connection for a server after it changes or is removed. */
  invalidate(serverId: string): void {
    const cached = this.#clients.get(serverId);
    if (!cached) return;
    this.#clients.delete(serverId);
    void cached.client.disconnect().catch(() => undefined);
  }

  async close(): Promise<void> {
    const clients = [...this.#clients.values()];
    this.#clients.clear();
    await Promise.allSettled(clients.map(cached => cached.client.disconnect()));
  }

  #clientFor(record: McpServerRecord): MCPClient {
    const updatedAt = record.updatedAt.getTime();
    const cached = this.#clients.get(record.id);
    if (cached?.updatedAt === updatedAt) return cached.client;
    // Disconnect first: it also removes the stale instance from MCPClient's id cache.
    if (cached) this.invalidate(record.id);
    const client = new MCPClient({
      id: `factory-mcp:${record.id}`,
      servers: { [record.slug]: this.buildDefinition(record) },
      registerProcessHooks: false,
    });
    this.#clients.set(record.id, { orgId: record.orgId, updatedAt, client });
    return client;
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

  const message = failure.message;
  const code = typeof failure.code === 'string' ? failure.code.toUpperCase() : '';
  if (failure.httpStatus === 401 || /unauthori[sz]ed|\b401\b/i.test(message)) {
    return {
      status: 'needs_auth',
      error:
        record.authType === 'oauth'
          ? 'Sign in to connect this server.'
          : record.authType === 'headers'
            ? 'The server rejected the saved credentials (HTTP 401). Update the headers and connect again.'
            : 'The server requires authentication (HTTP 401).',
    };
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
  return { status: 'error', error: `Could not connect: ${scrubSecrets(record, firstLine(message))}` };
}

function firstLine(message: string): string {
  const withoutPrefix = message.replace(/^Failed to connect to MCP server [^:]*:\s*/, '');
  const line = withoutPrefix.split('\n').find(part => part.trim() && !/^\s+at /.test(part)) ?? 'unknown error';
  return line.trim();
}

function scrubSecrets(record: McpServerRecord, text: string): string {
  const secrets = [...Object.values(record.headers ?? {}), record.oauthClientSecret]
    .filter((secret): secret is string => typeof secret === 'string' && secret.length > 0)
    // A bearer header's token can appear without its "Bearer " prefix.
    .flatMap(secret => [secret, secret.replace(/^\S+\s+/, '')])
    .filter(secret => secret.length >= 4)
    .sort((a, b) => b.length - a.length);
  let scrubbed = text;
  for (const secret of secrets) scrubbed = scrubbed.split(secret).join('[redacted]');
  return scrubbed.length > MAX_ERROR_LENGTH ? `${scrubbed.slice(0, MAX_ERROR_LENGTH - 1)}…` : scrubbed;
}
