import type { ToolsInput } from '@mastra/core/agent';
import { MCPClient } from '@mastra/mcp';

import type { ConnectClientOptions, IntegrationCatalogEntry, ProjectConnection, ResolvedClient } from './client.js';
import { listIntegrations, listProjectConnections, platformMcpTransport, resolveClient } from './client.js';
import { MastraConnectError } from './errors.js';
import { buildMcpMultiConnectionTools, buildProxyMultiConnectionTools } from './multi-connection.js';
import type { McpProviderRegistration, ProviderRegistration, ProxyProviderRegistration } from './registry.js';
import { TOOLS } from './registry.js';
import {
  connectionIdEnvVar,
  groupByIntegrationId,
  resolveProviderConnection,
  validateIntegrationOverrides,
} from './resolution.js';
import { applyToolFilter } from './toolset.js';

interface ToolsIntegrationOptionsBase {
  /** Pin a specific connection id (bypasses env-var fallback and single-active-connection resolution). */
  connectionId?: string;
  /**
   * MCP tool keys that may run without tool approval. Every other discovered
   * MCP tool requires approval, whatever the server's annotations claim, since
   * a remote catalog cannot be trusted to classify its own tools. An unknown
   * name skips the provider with a warning, so a typo never widens access.
   */
  autoApproveTools?: string[];
  /** Exclude this provider entirely, even if a connection exists. */
  disabled?: boolean;
}

/**
 * Per-provider overrides. `allowTools` and `disallowTools` are mutually
 * exclusive: pick one filter direction per provider. The XOR type catches
 * accidental co-occurrence in typed object literals; `tools()` also
 * validates at build time so loosely typed callers get a clear error.
 */
export type ToolsIntegrationOptions = ToolsIntegrationOptionsBase &
  (
    | {
        /** Restrict the returned toolset to these tool keys. Unknown names throw at build time. */
        allowTools?: string[];
        disallowTools?: never;
      }
    | {
        allowTools?: never;
        /** Remove these tool keys from the returned toolset. Unknown names throw at build time. */
        disallowTools?: string[];
      }
  );

export interface ToolsOptions {
  /** Platform project whose connections to discover. Falls back to MASTRA_PROJECT_ID. */
  projectId?: string;
  /**
   * Providers to enable, in one of two shapes:
   * - `["linear", "github"]` — string array shorthand for enabling providers
   *   with no per-provider options.
   * - `{ linear: { allowTools: [...] }, github: { disallowTools: [...] } }` —
   *   object form for per-provider overrides. Each provider may set at most
   *   one of `allowTools` and `disallowTools`; supplying both throws.
   *
   * Both forms may be combined by passing the object form; use the array
   * shorthand only when no overrides are needed.
   */
  integrations?: string[] | Record<string, ToolsIntegrationOptions>;
  client?: ConnectClientOptions;
  /** How long a resolved snapshot stays fresh, in milliseconds. Default 30_000. `0` revalidates every resolution. */
  ttlMs?: number;
}

// Keep the public resolver type structural so linked/local package builds do not
// bind consumers to the exact @mastra/core type instance used to build Connect.
type ResolvedToolsRecord = Record<string, { id: string }>;

/**
 * Live tool resolver returned by `tools()`. Pass it straight to an agent's
 * dynamic `tools` argument: Mastra calls it per generate/stream, so project
 * integrations attached or detached on the platform are reflected without
 * restarting the server. Call it directly (`await tools()`) when you need the
 * current flat tool record.
 */
export interface ToolsResolver {
  (ctx?: { requestContext?: unknown; mastra?: unknown }): Promise<ResolvedToolsRecord>;
  /** Drops the cached snapshot; the next resolution fetches fresh from the platform. */
  invalidate(): void;
  /** Fetches tools from the platform now and updates the cache. Rejects if the platform fetch fails. */
  refresh(): Promise<ResolvedToolsRecord>;
  /** Closes MCP transports owned by this resolver and clears its cached snapshot. */
  disconnect(): Promise<void>;
}

interface NormalizedRequest {
  registration: ProviderRegistration;
  options: ToolsIntegrationOptions;
}

const DEFAULT_TTL_MS = 30_000;
/** Minimum wait after a failed platform fetch before another background revalidation. */
const FAILURE_COOLDOWN_MS = 30_000;
let nextResolverId = 0;

/**
 * Returns a live toolset resolver over the project's Platform connections.
 * HTTP providers are loaded from the shipped `TOOLS` registry. MCP providers
 * are discovered from the Platform integration catalog. Tools from every supported
 * provider with a matching project connection are merged into one flat record
 * (matched by `integrationId`). The resolver serves a cached snapshot,
 * revalidating from the platform every `ttlMs`, so integrations attached
 * to (or detached from) the project are picked up (or dropped) without a
 * restart.
 *
 * Configuration errors (missing project id, bad ttlMs, malformed integration id)
 * throw here — at call time — so they surface at startup.
 * Expected provider absence is silently skipped. Actionable per-integration
 * problems during resolution (needs re-auth or ambiguity) are downgraded to
 * warn-and-skip so one bad integration never takes down the whole toolset.
 */
export function tools(options: ToolsOptions = {}): ToolsResolver {
  const projectId = options.projectId?.trim() || process.env.MASTRA_PROJECT_ID?.trim();
  if (!projectId) {
    throw new MastraConnectError('missing_project_id', 'Missing project id: set MASTRA_PROJECT_ID or pass projectId.');
  }
  if (options.ttlMs !== undefined && (!Number.isFinite(options.ttlMs) || options.ttlMs < 0)) {
    throw new MastraConnectError(
      'invalid_options',
      `Invalid ttlMs (${options.ttlMs}): expected a finite number of milliseconds >= 0.`,
    );
  }
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;

  const client = resolveClient(options.client);
  const resolverId = ++nextResolverId;
  // Keyed by `${integrationId}::${connectionId}` so multiple active
  // connections for the same provider each get their own MCP client.
  const mcpClients = new Map<string, { integrationId: string; connectionId: string; client: MCPClient }>();
  const integrationOverrides = normalizeIntegrationOverrides(options.integrations);
  validateIntegrationOverrides(integrationOverrides);
  validateIntegrationXor(integrationOverrides);

  let cache: { snapshot: ResolvedToolsRecord; fetchedAt: number } | undefined;
  let inflight: Promise<ResolvedToolsRecord> | undefined;
  let closing: Promise<void> | undefined;
  let lastFailureAt: number | undefined;

  /**
   * Loads the connection list and the integration catalog. A catalog failure
   * only matters when an active connection needs catalog-backed MCP discovery;
   * otherwise checked-in HTTP providers resolve with an empty catalog.
   */
  const loadSnapshotInputs = async (): Promise<{
    connections: ProjectConnection[];
    catalog: IntegrationCatalogEntry[];
  }> => {
    const [connectionsResult, catalogResult] = await Promise.allSettled([
      listProjectConnections(client, projectId),
      listIntegrations(client),
    ]);
    if (connectionsResult.status === 'rejected') throw connectionsResult.reason;
    const connections = connectionsResult.value;
    if (catalogResult.status === 'fulfilled') return { connections, catalog: catalogResult.value };

    const checkedIn = new Set(TOOLS.map(registration => registration.integrationId));
    const needsCatalog = connections.some(
      connection =>
        connection.status === 'active' &&
        !checkedIn.has(connection.integrationId) &&
        !integrationOverrides[connection.integrationId]?.disabled,
    );
    if (needsCatalog) throw catalogResult.reason;
    const reason = catalogResult.reason;
    console.warn(
      `[@mastra/connect] Platform catalog unavailable (${reason instanceof Error ? reason.message : String(reason)}); resolving checked-in providers only.`,
    );
    return { connections, catalog: [] };
  };

  /**
   * Fetches a fresh snapshot, deduplicating concurrent calls. Rejects on
   * failure. A refresh requested while `disconnect()` runs starts after it.
   */
  const refresh = (): Promise<ResolvedToolsRecord> => {
    if (closing) return closing.then(refresh);
    if (!inflight) {
      inflight = (async () => {
        try {
          const { connections, catalog } = await loadSnapshotInputs();
          const requests = buildRequests(integrationOverrides, catalog);
          const snapshot = await mapTools(connections, requests, options, client, mcpClients, resolverId);
          cache = { snapshot, fetchedAt: Date.now() };
          lastFailureAt = undefined;
          return snapshot;
        } catch (error) {
          lastFailureAt = Date.now();
          throw error;
        } finally {
          inflight = undefined;
        }
      })();
    }
    return inflight;
  };

  const resolve = async (): Promise<ResolvedToolsRecord> => {
    if (cache && Date.now() - cache.fetchedAt < ttlMs) {
      return cache.snapshot;
    }
    if (cache) {
      // Stale: serve the snapshot now and revalidate in the background,
      // swallowing (but warning about) fetch failures. During a sustained
      // platform outage the cooldown keeps this to one request per window
      // instead of one per agent call.
      const staleSnapshot = cache.snapshot;
      const inCooldown = lastFailureAt !== undefined && Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS;
      if (!inCooldown && !inflight && !closing) {
        const staleFetchedAt = cache.fetchedAt;
        void refresh().catch((error: unknown) => {
          console.warn(
            `[@mastra/connect] Keeping cached tools (fetched ${Date.now() - staleFetchedAt}ms ago); platform refresh failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        });
      }
      return staleSnapshot;
    }
    return refresh();
  };

  return Object.assign(resolve, {
    invalidate: (): void => {
      cache = undefined;
    },
    refresh,
    disconnect: (): Promise<void> => {
      // Let the refresh in progress settle first so it cannot repopulate the
      // cache or register an MCP client after cleanup; refreshes requested
      // meanwhile wait for `closing` and start afterwards.
      closing ??= (async () => {
        try {
          while (inflight) await inflight.catch(() => undefined);
          cache = undefined;
          const clients = Array.from(mcpClients.values(), entry => entry.client);
          mcpClients.clear();
          await Promise.allSettled(clients.map(mcp => mcp.disconnect()));
        } finally {
          closing = undefined;
        }
      })();
      return closing;
    },
  });
}

/**
 * Turns the two accepted `integrations` shapes into the internal Record form.
 * The string-array shorthand (`["linear", "github"]`) becomes
 * `{ linear: {}, github: {} }`; the object form passes through unchanged.
 * Also rejects malformed inputs early (non-string array entries, duplicates)
 * so a bad option throws at tools() time rather than at first refresh.
 */
function normalizeIntegrationOverrides(
  integrations: ToolsOptions['integrations'],
): Record<string, ToolsIntegrationOptions> {
  if (integrations === undefined) return {};
  if (Array.isArray(integrations)) {
    const record: Record<string, ToolsIntegrationOptions> = {};
    for (const entry of integrations) {
      if (typeof entry !== 'string') {
        throw new MastraConnectError(
          'invalid_options',
          `Invalid integrations entry: expected a string integration id, got ${typeof entry}.`,
        );
      }
      if (record[entry] !== undefined) {
        throw new MastraConnectError('invalid_options', `Duplicate integration '${entry}' in integrations array.`);
      }
      record[entry] = {};
    }
    return record;
  }
  return integrations;
}

/**
 * Rejects any provider that sets both `allowTools` and `disallowTools`.
 * The types make this a compile-time error for typed literals, but this
 * runtime guard catches loosely typed inputs (e.g. built from JSON or a
 * `Record<string, unknown>` upstream).
 */
function validateIntegrationXor(integrations: Record<string, ToolsIntegrationOptions>): void {
  for (const [integrationId, providerOptions] of Object.entries(integrations)) {
    const filters = providerOptions as { allowTools?: unknown; disallowTools?: unknown };
    if (filters.allowTools !== undefined && filters.disallowTools !== undefined) {
      throw new MastraConnectError(
        'invalid_options',
        `Invalid options for '${integrationId}': allowTools and disallowTools are mutually exclusive; set at most one.`,
      );
    }
  }
}

function buildRequests(
  integrations: Record<string, ToolsIntegrationOptions>,
  catalog: IntegrationCatalogEntry[],
): NormalizedRequest[] {
  const overrides = integrations;
  const registrations = new Map(TOOLS.map(registration => [registration.integrationId, registration]));
  const catalogIds = new Set(catalog.map(integration => integration.id));
  for (const integration of catalog) {
    if (!integration.capabilities.mcp) continue;
    registrations.set(integration.id, {
      integrationId: integration.id,
      envVar: connectionIdEnvVar(integration.id),
      transport: 'mcp',
    });
  }
  for (const integrationId of Object.keys(overrides)) {
    if (!registrations.has(integrationId) && !catalogIds.has(integrationId)) {
      console.warn(`[@mastra/connect] Ignoring unknown integration override '${integrationId}'.`);
    }
  }
  const requests: NormalizedRequest[] = [];
  for (const registration of registrations.values()) {
    const providerOptions = overrides[registration.integrationId] ?? {};
    if (providerOptions.disabled) continue;
    requests.push({ registration, options: providerOptions });
  }
  return requests;
}

/** Maps one platform connection list snapshot to a flat tool record without allowing ambiguous tool ownership. */
async function mapTools(
  connections: ProjectConnection[],
  requests: NormalizedRequest[],
  options: ToolsOptions,
  client: ResolvedClient,
  mcpClients: Map<string, { integrationId: string; connectionId: string; client: MCPClient }>,
  resolverId: number,
): Promise<ResolvedToolsRecord> {
  const byIntegrationId = groupByIntegrationId(connections);
  // Set of ${integrationId}::${connectionId} keys still in use this snapshot.
  const activeMcpKeys = new Set<string>();
  const result: ResolvedToolsRecord = {};
  const toolOwners = new Map<string, string>();
  for (const request of requests) {
    const integrationId = request.registration.integrationId;
    let providerTools: ToolsInput | undefined;
    try {
      const candidates = byIntegrationId.get(integrationId) ?? [];
      if (candidates.length === 0) continue;
      const resolution = resolveProviderConnection(
        {
          integrationId,
          envVar: request.registration.envVar,
          connectionId: request.options.connectionId,
        },
        candidates,
      );
      if (resolution.kind === 'skip') continue;
      if (resolution.kind === 'single') {
        if (request.registration.transport === 'mcp') {
          activeMcpKeys.add(`${integrationId}::${resolution.connectionId}`);
          providerTools = await discoverMcpTools({
            registration: request.registration,
            connectionId: resolution.connectionId,
            allowTools: request.options.allowTools,
            disallowTools: request.options.disallowTools,
            autoApproveTools: request.options.autoApproveTools,
            client,
            mcpClients,
            resolverId,
          });
        } else {
          providerTools = request.registration.createTools({
            connectionId: resolution.connectionId,
            client: options.client,
            ...providerFilterOptions(request.options),
          } as Parameters<typeof request.registration.createTools>[0]);
        }
      } else {
        // kind === 'multi'
        if (request.registration.transport === 'mcp') {
          for (const connection of resolution.connections) {
            activeMcpKeys.add(`${integrationId}::${connection.id}`);
          }
          providerTools = await buildMcpMultiConnectionTools({
            registration: request.registration,
            connections: resolution.connections,
            allowTools: request.options.allowTools,
            disallowTools: request.options.disallowTools,
            autoApproveTools: request.options.autoApproveTools,
            client,
            mcpClients,
            resolverId,
          });
        } else {
          providerTools = buildProxyMultiConnectionTools({
            registration: request.registration as ProxyProviderRegistration,
            connections: resolution.connections,
            allowTools: request.options.allowTools,
            disallowTools: request.options.disallowTools,
            client: options.client,
          });
        }
      }
    } catch (error) {
      console.warn(
        `[@mastra/connect] Skipping ${integrationId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    for (const toolKey of Object.keys(providerTools)) {
      const existingOwner = toolOwners.get(toolKey);
      if (existingOwner) {
        throw new MastraConnectError(
          'invalid_options',
          `Duplicate tool key '${toolKey}' from providers '${existingOwner}' and '${integrationId}'.`,
        );
      }
      toolOwners.set(toolKey, integrationId);
    }
    Object.assign(result, providerTools);
  }

  const staleClients = Array.from(mcpClients.entries()).filter(([key]) => !activeMcpKeys.has(key));
  for (const [key] of staleClients) mcpClients.delete(key);
  await Promise.allSettled(staleClients.map(([, entry]) => entry.client.disconnect()));
  return result;
}

/**
 * Extracts whichever provider tool filter is set. Since `ToolsIntegrationOptions`
 * is an XOR union and tools() validates co-occurrence up front, at most one
 * of the two will ever be defined here.
 */
function providerFilterOptions(options: ToolsIntegrationOptions): {
  allowTools?: string[];
  disallowTools?: string[];
} {
  return options.allowTools !== undefined
    ? { allowTools: options.allowTools }
    : options.disallowTools !== undefined
      ? { disallowTools: options.disallowTools }
      : {};
}

async function discoverMcpTools(input: {
  registration: McpProviderRegistration;
  connectionId: string;
  allowTools?: string[];
  disallowTools?: string[];
  autoApproveTools?: string[];
  client: ResolvedClient;
  mcpClients: Map<string, { integrationId: string; connectionId: string; client: MCPClient }>;
  resolverId: number;
}): Promise<ResolvedToolsRecord> {
  const { registration, connectionId, allowTools, disallowTools, autoApproveTools, client, mcpClients, resolverId } =
    input;
  const autoApproved = new Set(autoApproveTools ?? []);
  const cacheKey = `${registration.integrationId}::${connectionId}`;
  let entry = mcpClients.get(cacheKey);
  if (!entry) {
    const transport = platformMcpTransport(client, connectionId);
    entry = {
      integrationId: registration.integrationId,
      connectionId,
      client: new MCPClient({
        id: `mastra-connect-${resolverId}-${registration.integrationId}-${connectionId}`,
        servers: {
          [registration.integrationId]: {
            ...transport,
            // Server annotations are advisory: a remote catalog could mark a
            // destructive tool non-destructive. Only a local allowlist skips
            // approval.
            requireToolApproval: ({ toolName }) =>
              !autoApproved.has(`${registration.integrationId}_${String(toolName)}`),
          },
        },
      }),
    };
    mcpClients.set(cacheKey, entry);
  }

  const discovery = await entry.client.listToolsWithErrors();
  const error = discovery.errors[registration.integrationId];
  if (error) throw new Error(`MCP tool discovery failed: ${error}`);
  const unknown = [...autoApproved].filter(name => !(name in discovery.tools));
  if (unknown.length > 0) {
    throw new MastraConnectError(
      'invalid_options',
      `Unknown tool name(s) in autoApproveTools for '${registration.integrationId}': ${unknown.join(', ')}. Known tools: ${Object.keys(discovery.tools).join(', ')}.`,
    );
  }
  return applyToolFilter(discovery.tools, { allowTools, disallowTools }) as ResolvedToolsRecord;
}
