import type { ToolsInput } from '@mastra/core/agent';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';
import type { ApiRoute } from '@mastra/core/server';
import { MCPClient } from '@mastra/mcp';

import type { ConnectClientOptions, IntegrationCatalogEntry, ProjectConnection, ResolvedClient } from './client.js';
import { listIntegrations, listProjectConnections, platformMcpTransport, resolveClient } from './client.js';
import {
  buildConnectIntegrationTool,
  CONNECT_INTEGRATION_TOOL,
  connectRoutes,
  ConnectSignalProvider,
  listenForChannelInstalls,
} from './connect-requests.js';
import type { ConnectRequestHost, RequestConnectionsOptions } from './connect-requests.js';
import { MastraConnectConfigError, MastraConnectError } from './errors.js';
import {
  buildMcpMultiConnectionTools,
  buildProxyMultiConnectionTools,
  listConnectionsToolKey,
} from './multi-connection.js';
import type { McpProviderRegistration, ProviderRegistration, ProxyProviderRegistration } from './registry.js';
import { CHANNELS, PROVIDERS } from './registry.js';
import {
  connectionIdEnvVar,
  groupByIntegrationId,
  resolveProviderConnection,
  validateProviderIds,
} from './resolution.js';
import { applyToolFilter, compileToolMatcher, expandToolPatterns } from './toolset.js';

interface ToolsProviderOptionsBase {
  /** Pin a specific connection id (bypasses env-var fallback and single-active-connection resolution). */
  connectionId?: string;
  /**
   * Tool-approval policy for this provider, applied to discovered MCP tools
   * and checked-in HTTP tools alike. Tools do not require approval by
   * default, matching `@mastra/mcp`'s own default. Pass `true` to require
   * approval for every tool on this provider, or an array of tool keys to
   * require approval only for those tools; entries containing `*` are globs
   * (e.g. `'linear_delete_*'`). Unknown names and globs that match nothing
   * fail resolution with an `invalid_options` error so a typo never
   * silently widens access. (Explicit `false` is equivalent to omitting the
   * option.)
   */
  requireApproval?: boolean | string[];
}

/**
 * Per-provider overrides. `allowTools` and `disallowTools` are mutually
 * exclusive: pick one filter direction per provider. The XOR type catches
 * accidental co-occurrence in typed object literals; `tools()` also
 * validates at build time so loosely typed callers get a clear error.
 */
export type ToolsProviderOptions = ToolsProviderOptionsBase &
  (
    | {
        /**
         * Restrict the returned toolset to these tool keys. Entries containing
         * `*` are globs (e.g. `'linear_get_*'`). Unknown names and globs that
         * match nothing throw at build time.
         */
        allowTools?: string[];
        disallowTools?: never;
      }
    | {
        allowTools?: never;
        /**
         * Remove these tool keys from the returned toolset. Entries containing
         * `*` are globs (e.g. `'linear_delete_*'`). Unknown names and globs
         * that match nothing throw at build time.
         */
        disallowTools?: string[];
      }
  );

export interface ToolsOptions {
  /** Platform project whose connections to discover. Falls back to MASTRA_PROJECT_ID. */
  projectId?: string;
  /**
   * Which providers to resolve, in one of two shapes:
   * - `["linear", "github"]` — an allowlist: only the listed providers
   *   resolve, with default options. Anything else connected to the project
   *   is ignored.
   * - `{ linear: true, github: { allowTools: [...] }, notion: false }` —
   *   per-provider configuration. Every connected provider still resolves
   *   unless excluded: `true` (or `{}`) enables with defaults, `false`
   *   excludes, and an options object configures tool filters, approval
   *   policy, or a pinned connection. Each provider may set at most one of
   *   `allowTools` and `disallowTools`; supplying both throws.
   *
   * Omit the option entirely to resolve every provider the project has a
   * connection for.
   */
  providers?: string[] | Record<string, boolean | ToolsProviderOptions>;
  /**
   * Default tool filter applied to every provider that does not set its own
   * `allowTools`/`disallowTools`. Entries containing `*` are globs. Unlike
   * the per-provider filters, defaults apply leniently: an entry that
   * matches nothing on a given provider simply does not apply there (the
   * provider set is live, so a default like `['*_get_*']` must tolerate
   * providers without matching tools). An entry that matches nothing across
   * the whole resolution logs a warning. Mutually exclusive with
   * `disallowTools`. A provider that sets either filter option opts out of
   * both defaults.
   */
  allowTools?: string[];
  /** Default disallow filter; see {@link ToolsOptions.allowTools} for semantics. */
  disallowTools?: string[];
  /**
   * Default tool-approval policy applied to every provider that does not set
   * its own `requireApproval`. `true` gates every tool (except the synthetic
   * `<provider>__list_connections` wrappers); an array gates matching keys,
   * with the same lenient glob semantics as the default filters. A provider
   * can opt out of a global `requireApproval: true` with
   * `requireApproval: false`.
   */
  requireApproval?: boolean | string[];
  client?: ConnectClientOptions;
  /** How long a resolved snapshot stays fresh, in milliseconds. Default 30_000. `0` revalidates every resolution. */
  ttlMs?: number;
  requestConnections?: RequestConnectionsOptions;
}

// Keep the public resolver type structural so linked/local package builds do not
// bind consumers to the exact @mastra/core type instance used to build Connect.
type ResolvedToolsRecord = Record<string, { id: string }>;

/** Context Mastra passes when invoking the resolver as a dynamic `tools` argument. */
export interface ToolsResolverContext {
  requestContext?: unknown;
  mastra?: unknown;
}

/**
 * Tools accepted by {@link ToolsResolver.with}: a static tool record (e.g.
 * `createTool()` outputs) or a function — sync or async, optionally reading
 * the per-request context — returning one.
 */
export type ToolsWithInput =
  | Record<string, { id: string }>
  | ((ctx?: ToolsResolverContext) => Record<string, { id: string }> | Promise<Record<string, { id: string }>>);

/**
 * Live tool resolver returned by `tools()`. Pass it straight to an agent's
 * dynamic `tools` argument: Mastra calls it per generate/stream, so providers
 * connected or disconnected on the platform are reflected without
 * restarting the server. Call it directly (`await tools()`) when you need the
 * current flat tool record.
 */
export interface ToolsResolver {
  (ctx?: ToolsResolverContext): Promise<ResolvedToolsRecord>;
  /** Fetches tools from the platform now and updates the cache. Rejects if the platform fetch fails. */
  refresh(): Promise<ResolvedToolsRecord>;
  /** Closes MCP transports owned by this resolver and clears its cached snapshot. */
  disconnect(): Promise<void>;
  /**
   * Returns a new resolver that merges `extra` tools into every resolution,
   * so an agent can combine its own tools with connect tools in one
   * expression: `tools: connectTools.with({ weatherTool })`. On a key
   * collision the extra tools win — connect keys are provider-prefixed, so
   * collisions only happen deliberately. The cache handles (`refresh`,
   * `disconnect`) delegate to the base resolver, and `.with()` calls chain.
   */
  with(extra: ToolsWithInput): ToolsResolver;
  signalProvider(): ConnectSignalProvider;
  routes(): ApiRoute[];
}

interface NormalizedRequest {
  registration: ProviderRegistration;
  options: ToolsProviderOptions;
}

const DEFAULT_TTL_MS = 30_000;
/** Minimum wait after a failed platform fetch before another background revalidation. */
const FAILURE_COOLDOWN_MS = 30_000;
let nextResolverId = 0;

/**
 * Returns a live toolset resolver over the project's Platform connections.
 * HTTP providers are loaded from the shipped `PROVIDERS` registry. MCP providers
 * are discovered from the Platform integration catalog. Tools from every supported
 * provider with a matching project connection are merged into one flat record
 * (matched by `integrationId`). The resolver serves a cached snapshot,
 * revalidating from the platform every `ttlMs`, so providers connected
 * to (or disconnected from) the project are picked up (or dropped) without a
 * restart.
 *
 * Configuration errors (missing project id, bad ttlMs, malformed integration id,
 * the removed `autoApproveTools` key) throw here — at call time — so they
 * surface at startup. Configuration errors that need discovery to detect
 * (an unknown tool name in `requireApproval`) fail the resolution instead.
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
  const normalizedProviders = normalizeProviderOverrides(options.providers);
  const providerOverrides = normalizedProviders.overrides;
  validateProviderIds(providerOverrides);
  validateProviderXor(providerOverrides);
  validateRequireApproval(providerOverrides);
  rejectRemovedAutoApproveTools(providerOverrides);
  if (options.allowTools !== undefined && options.disallowTools !== undefined) {
    throw new MastraConnectError(
      'invalid_options',
      'Top-level allowTools and disallowTools are mutually exclusive; set at most one.',
    );
  }
  if (
    options.requireApproval !== undefined &&
    typeof options.requireApproval !== 'boolean' &&
    !(Array.isArray(options.requireApproval) && options.requireApproval.every(name => typeof name === 'string'))
  ) {
    throw new MastraConnectError(
      'invalid_options',
      'Top-level requireApproval must be a boolean or an array of tool keys.',
    );
  }

  let cache:
    | {
        snapshot: ResolvedToolsRecord;
        fetchedAt: number;
        connections: ProjectConnection[];
        catalog: IntegrationCatalogEntry[];
      }
    | undefined;
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
    catalogAvailable: boolean;
  }> => {
    const [connectionsResult, catalogResult] = await Promise.allSettled([
      listProjectConnections(client, projectId),
      listIntegrations(client),
    ]);
    if (connectionsResult.status === 'rejected') throw connectionsResult.reason;
    const connections = connectionsResult.value;
    if (catalogResult.status === 'fulfilled') {
      return { connections, catalog: catalogResult.value, catalogAvailable: true };
    }

    const checkedIn = new Set(PROVIDERS.map(registration => registration.integrationId));
    const needsCatalog = connections.some(
      connection =>
        connection.status === 'active' &&
        !checkedIn.has(connection.integrationId) &&
        !providerOverrides[connection.integrationId]?.disabled &&
        (normalizedProviders.only === undefined || normalizedProviders.only.has(connection.integrationId)),
    );
    if (needsCatalog) throw catalogResult.reason;
    const reason = catalogResult.reason;
    console.warn(
      `[@mastra/connect] Platform catalog unavailable (${reason instanceof Error ? reason.message : String(reason)}); resolving checked-in providers only.`,
    );
    return { connections, catalog: [], catalogAvailable: false };
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
          const { connections, catalog, catalogAvailable } = await loadSnapshotInputs();
          const requests = buildRequests(normalizedProviders, catalog, catalogAvailable);
          const snapshot = await mapTools(connections, requests, options, client, mcpClients, resolverId);
          cache = { snapshot, fetchedAt: Date.now(), connections, catalog };
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

  const requestHost = createRequestHost(options, client, projectId, {
    refresh,
    catalog: () => cache?.catalog ?? [],
  });

  const resolveForRun = async (ctx?: ToolsResolverContext): Promise<ResolvedToolsRecord> => {
    if (!requestHost) return resolve();
    const given = ctx?.requestContext as RequestContext | undefined;
    const requestContext = typeof given?.get === 'function' ? given : new RequestContext();
    const snapshot = await resolve();
    const allowed = await requestHost.allow({
      requestContext,
      threadId: requestContext.get(MASTRA_THREAD_ID_KEY) as string | undefined,
      resourceId: requestContext.get(MASTRA_RESOURCE_ID_KEY) as string | undefined,
    });
    const metaTool = allowed && cache ? buildConnectIntegrationTool(requestHost, cache.connections) : undefined;
    return metaTool ? { ...snapshot, [CONNECT_INTEGRATION_TOOL]: metaTool } : snapshot;
  };

  const requireRequestHost = (method: string): ConnectRequestHost => {
    if (!requestHost) {
      throw new MastraConnectError('invalid_options', `${method}() needs the requestConnections option.`);
    }
    return requestHost;
  };

  const resolver: ToolsResolver = Object.assign(resolveForRun, {
    refresh,
    disconnect: (): Promise<void> => {
      // Let the refresh in progress settle first so it cannot repopulate the
      // cache or register an MCP client after cleanup; refreshes requested
      // meanwhile wait for `closing` and start afterwards.
      closing ??= (async () => {
        try {
          while (inflight) await inflight.catch(() => undefined);
          cache = undefined;
          for (const poller of requestHost?.pollers ?? []) poller.abort();
          requestHost?.pendingInstalls.clear();
          const clients = Array.from(mcpClients.values(), entry => entry.client);
          mcpClients.clear();
          await Promise.allSettled(clients.map(mcp => mcp.disconnect()));
        } finally {
          closing = undefined;
        }
      })();
      return closing;
    },
    with: (extra: ToolsWithInput): ToolsResolver => withExtraTools(resolver, extra),
    signalProvider: (): ConnectSignalProvider => new ConnectSignalProvider(requireRequestHost('signalProvider')),
    routes: (): ApiRoute[] => connectRoutes(requireRequestHost('routes').webhookSecret),
  });
  return resolver;
}

function createRequestHost(
  options: ToolsOptions,
  client: ResolvedClient,
  projectId: string,
  snapshot: Pick<ConnectRequestHost, 'refresh' | 'catalog'>,
): ConnectRequestHost | undefined {
  const requestConnections = options.requestConnections;
  if (!requestConnections) return undefined;
  if (typeof requestConnections.allow !== 'function') {
    throw new MastraConnectError('invalid_options', 'requestConnections.allow must be a function.');
  }
  const integrations = Array.isArray(options.providers)
    ? options.providers
    : Object.entries(options.providers ?? {}).flatMap(([id, value]) => (value === true ? [id] : []));
  const channels = requestConnections.channels ?? [];
  const knownChannels = new Set(CHANNELS.map(registration => registration.integrationId));
  const unknownChannels = channels.filter(id => !knownChannels.has(id));
  if (unknownChannels.length > 0) {
    throw new MastraConnectError(
      'invalid_options',
      `Unknown channel(s) in requestConnections.channels: ${unknownChannels.join(', ')}. Known channels: ${[...knownChannels].join(', ')}.`,
    );
  }
  if (integrations.length + channels.length === 0) {
    throw new MastraConnectError(
      'invalid_options',
      'requestConnections needs a providers allowlist (an array of ids, or `true` entries in the record form) or requestConnections.channels.',
    );
  }
  if (integrations.length + channels.length > 25) {
    console.warn(
      `[@mastra/connect] requestConnections offers ${integrations.length + channels.length} providers; connect_integration lists each one, so narrow the allowlist to keep its description short.`,
    );
  }
  const webhookUrl = process.env.MASTRA_CONNECT_WEBHOOK_URL?.trim() || undefined;
  const webhookSecret = process.env.MASTRA_CONNECT_WEBHOOK_SECRET?.trim() || undefined;
  if (!webhookUrl && process.env.MASTRA_DEV !== 'true') {
    throw new MastraConnectError(
      'invalid_options',
      'requestConnections needs MASTRA_CONNECT_WEBHOOK_URL outside `mastra dev`, so Platform can report finished connections.',
    );
  }
  if (webhookUrl && !webhookSecret) {
    throw new MastraConnectError(
      'invalid_options',
      'MASTRA_CONNECT_WEBHOOK_URL is set without MASTRA_CONNECT_WEBHOOK_SECRET, so Platform webhooks could not be verified.',
    );
  }
  const host: ConnectRequestHost = {
    client,
    projectId,
    allow: requestConnections.allow,
    webhookUrl,
    webhookSecret,
    integrations,
    channels,
    pendingInstalls: new Map(),
    pollers: new Set(),
    ...snapshot,
  };
  if (channels.length > 0) listenForChannelInstalls(host);
  return host;
}

/**
 * Builds the resolver `.with()` returns: resolutions merge the base
 * resolver's tools with `extra` (extra wins on key collision), cache handles
 * delegate to the base, and further `.with()` calls chain.
 */
function withExtraTools(base: ToolsResolver, extra: ToolsWithInput): ToolsResolver {
  const resolveExtra = typeof extra === 'function' ? extra : (): Record<string, { id: string }> => extra;
  const resolve = async (ctx?: ToolsResolverContext): Promise<ResolvedToolsRecord> => {
    const [baseTools, extraTools] = await Promise.all([base(ctx), resolveExtra(ctx)]);
    return { ...baseTools, ...extraTools };
  };
  const resolver: ToolsResolver = Object.assign(resolve, {
    refresh: async (): Promise<ResolvedToolsRecord> => {
      const [baseTools, extraTools] = await Promise.all([base.refresh(), resolveExtra()]);
      return { ...baseTools, ...extraTools };
    },
    disconnect: (): Promise<void> => base.disconnect(),
    with: (more: ToolsWithInput): ToolsResolver => withExtraTools(resolver, more),
    signalProvider: (): ConnectSignalProvider => base.signalProvider(),
    routes: (): ApiRoute[] => base.routes(),
  });
  return resolver;
}

/**
 * Internal per-provider options: the public shape plus the exclusion marker
 * that the `false` shorthand expands to.
 */
type NormalizedToolsProviderOptions = ToolsProviderOptions & { disabled?: boolean };

/** Internal normalization of the `providers` option. */
interface NormalizedProviders {
  /** Per-provider options with boolean shorthands expanded. */
  overrides: Record<string, NormalizedToolsProviderOptions>;
  /**
   * Set when the array form was used: only these providers resolve. The
   * record form never restricts — unlisted providers keep resolving.
   */
  only: Set<string> | undefined;
}

/**
 * Turns the two accepted `providers` shapes into the internal form. The
 * array form (`["linear", "github"]`) becomes an allowlist with default
 * options; the record form expands boolean shorthands (`true` → `{}`,
 * `false` → an internal exclusion marker). Malformed inputs (non-string
 * array entries, duplicates, non-boolean/non-object record values) throw at
 * tools() time rather than at first refresh.
 */
function normalizeProviderOverrides(providers: ToolsOptions['providers']): NormalizedProviders {
  if (providers === undefined) return { overrides: {}, only: undefined };
  if (Array.isArray(providers)) {
    const overrides: Record<string, NormalizedToolsProviderOptions> = {};
    for (const entry of providers) {
      if (typeof entry !== 'string') {
        throw new MastraConnectError(
          'invalid_options',
          `Invalid providers entry: expected a string provider id, got ${typeof entry}.`,
        );
      }
      if (overrides[entry] !== undefined) {
        throw new MastraConnectError('invalid_options', `Duplicate provider '${entry}' in providers array.`);
      }
      overrides[entry] = {};
    }
    return { overrides, only: new Set(Object.keys(overrides)) };
  }
  const overrides: Record<string, NormalizedToolsProviderOptions> = {};
  for (const [providerId, value] of Object.entries(providers)) {
    if (value === undefined) continue;
    if (value === true) {
      overrides[providerId] = {};
    } else if (value === false) {
      overrides[providerId] = { disabled: true };
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      overrides[providerId] = value;
    } else {
      throw new MastraConnectError(
        'invalid_options',
        `Invalid providers entry for '${providerId}': expected true, false, or an options object, got ${value === null ? 'null' : Array.isArray(value) ? 'an array' : typeof value}.`,
      );
    }
  }
  return { overrides, only: undefined };
}

/**
 * Rejects any provider that sets both `allowTools` and `disallowTools`.
 * The types make this a compile-time error for typed literals, but this
 * runtime guard catches loosely typed inputs (e.g. built from JSON or a
 * `Record<string, unknown>` upstream).
 */
function validateProviderXor(providers: Record<string, NormalizedToolsProviderOptions>): void {
  for (const [integrationId, providerOptions] of Object.entries(providers)) {
    const filters = providerOptions as { allowTools?: unknown; disallowTools?: unknown };
    if (filters.allowTools !== undefined && filters.disallowTools !== undefined) {
      throw new MastraConnectError(
        'invalid_options',
        `Invalid options for '${integrationId}': allowTools and disallowTools are mutually exclusive; set at most one.`,
      );
    }
  }
}

/**
 * Rejects a `requireApproval` value that is not a boolean or an array of
 * string tool keys. The approval branches check for literal `true` or an
 * array, so a loosely typed value like `'true'` would otherwise disable
 * approval on MCP providers silently (and crash the HTTP path into
 * warn-and-skip) instead of gating tools as the author intended.
 */
function validateRequireApproval(providers: Record<string, NormalizedToolsProviderOptions>): void {
  for (const [integrationId, providerOptions] of Object.entries(providers)) {
    const requireApproval = (providerOptions as Record<string, unknown>).requireApproval;
    if (requireApproval === undefined || typeof requireApproval === 'boolean') continue;
    if (Array.isArray(requireApproval) && requireApproval.every(name => typeof name === 'string')) continue;
    throw new MastraConnectError(
      'invalid_options',
      `Invalid options for '${integrationId}': requireApproval must be a boolean or an array of tool keys.`,
    );
  }
}

/**
 * Rejects the removed `autoApproveTools` option by name. Discovered MCP tools
 * no longer require approval by default, so a loosely typed config still
 * carrying this key would otherwise be ignored silently and its tools would
 * run without the prompts the author expected.
 */
function rejectRemovedAutoApproveTools(providers: Record<string, NormalizedToolsProviderOptions>): void {
  for (const [integrationId, providerOptions] of Object.entries(providers)) {
    if ('autoApproveTools' in (providerOptions as Record<string, unknown>)) {
      throw new MastraConnectError(
        'invalid_options',
        `Invalid options for '${integrationId}': autoApproveTools was removed. Tools no longer require approval by default; opt in with requireApproval: true or a list of tool keys to gate.`,
      );
    }
  }
}

function buildRequests(
  providers: NormalizedProviders,
  catalog: IntegrationCatalogEntry[],
  catalogAvailable: boolean,
): NormalizedRequest[] {
  const { overrides, only } = providers;
  const registrations = new Map(PROVIDERS.map(registration => [registration.integrationId, registration]));
  const catalogIds = new Set(catalog.map(integration => integration.id));
  for (const integration of catalog) {
    if (!integration.capabilities.mcp) continue;
    registrations.set(integration.id, {
      integrationId: integration.id,
      envVar: connectionIdEnvVar(integration.id),
      transport: 'mcp',
    });
  }
  // A provider id that is neither checked in nor in the platform catalog is a
  // typo: silently resolving nothing would hide it forever, so fail the
  // resolution. Excluded entries are harmless no-ops, and when the catalog is
  // unreachable an unknown id could be a legitimate MCP provider, so both
  // downgrade to the skip behavior.
  const unknown = Object.keys(overrides).filter(
    integrationId =>
      !registrations.has(integrationId) && !catalogIds.has(integrationId) && !overrides[integrationId]?.disabled,
  );
  if (unknown.length > 0) {
    if (catalogAvailable) {
      throw new MastraConnectConfigError(
        `Unknown provider${unknown.length > 1 ? 's' : ''} in the providers option: ${unknown.map(id => `'${id}'`).join(', ')}. Expected a checked-in provider id or a platform catalog integration id.`,
      );
    }
    for (const integrationId of unknown) {
      console.warn(
        `[@mastra/connect] Platform catalog unavailable; cannot verify provider '${integrationId}'. Skipping it this resolution.`,
      );
    }
  }
  const requests: NormalizedRequest[] = [];
  for (const registration of registrations.values()) {
    if (only !== undefined && !only.has(registration.integrationId)) continue;
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
  // Top-level default entries that matched at least one tool somewhere.
  const matchedDefaultEntries = new Set<string>();
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
            requireApproval: request.options.requireApproval,
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
          applyProxyRequireApproval(providerTools, integrationId, request.options.requireApproval);
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
            requireApproval: request.options.requireApproval,
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
          applyProxyRequireApproval(providerTools, integrationId, request.options.requireApproval, [
            listConnectionsToolKey(integrationId),
          ]);
        }
      }
    } catch (error) {
      // Warn-and-skip exists so one unreachable provider never takes down the
      // whole resolution. Configuration mistakes (like an unknown tool name in
      // `requireApproval`) are different: skipping would silently drop the
      // provider AND its approval gates, so rethrow them to the caller.
      if (error instanceof MastraConnectConfigError) throw error;
      console.warn(
        `[@mastra/connect] Skipping ${integrationId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    // Top-level defaults apply after the provider's tools are built, so the
    // strict per-provider paths above stay untouched and a provider that set
    // its own filter/approval opted out entirely.
    const hasOwnFilter = request.options.allowTools !== undefined || request.options.disallowTools !== undefined;
    if (!hasOwnFilter && (options.allowTools !== undefined || options.disallowTools !== undefined)) {
      providerTools = applyDefaultFilter(providerTools, options, integrationId, matchedDefaultEntries);
    }
    if (request.options.requireApproval === undefined && options.requireApproval !== undefined) {
      const policy = options.requireApproval;
      if (policy !== false) {
        applyDefaultRequireApproval(providerTools, policy, integrationId, matchedDefaultEntries);
      }
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

  // Lenient defaults cannot fail per provider, so a typo'd entry only shows
  // up here: warn when it matched nothing across the whole resolution. Skip
  // the check when nothing resolved at all (no connections yet is normal).
  if (Object.keys(result).length > 0) {
    const defaultEntries = [
      ...(options.allowTools ?? []),
      ...(options.disallowTools ?? []),
      ...(Array.isArray(options.requireApproval) ? options.requireApproval : []),
    ];
    for (const entry of defaultEntries) {
      if (!matchedDefaultEntries.has(entry)) {
        console.warn(`[@mastra/connect] Top-level entry '${entry}' matched no tools on any resolved provider.`);
      }
    }
  }

  const staleClients = Array.from(mcpClients.entries()).filter(([key]) => !activeMcpKeys.has(key));
  for (const [key] of staleClients) mcpClients.delete(key);
  await Promise.allSettled(staleClients.map(([, entry]) => entry.client.disconnect()));
  return result;
}

/**
 * Applies the top-level default filter to a provider that set no filter of
 * its own. Lenient by design: the provider set is live, so a default entry
 * that matches nothing on this provider simply does not apply here. Entries
 * that match are recorded in `matchedEntries` so mapTools can warn about
 * defaults that matched nothing anywhere. The synthetic
 * `<provider>__list_connections` wrapper is never filtered by defaults,
 * matching the per-provider multi-connection behavior.
 */
function applyDefaultFilter(
  providerTools: ToolsInput,
  defaults: { allowTools?: string[]; disallowTools?: string[] },
  integrationId: string,
  matchedEntries: Set<string>,
): ToolsInput {
  const listToolKey = listConnectionsToolKey(integrationId);
  const entries = defaults.allowTools ?? defaults.disallowTools ?? [];
  const matchers = entries.map(entry => ({ entry, matches: compileToolMatcher([entry]) }));
  const filtered: ToolsInput = {};
  for (const [key, tool] of Object.entries(providerTools)) {
    if (key === listToolKey) {
      filtered[key] = tool;
      continue;
    }
    let matchedAny = false;
    for (const { entry, matches } of matchers) {
      if (matches(key)) {
        matchedEntries.add(entry);
        matchedAny = true;
      }
    }
    const keep = defaults.allowTools !== undefined ? matchedAny : !matchedAny;
    if (keep) filtered[key] = tool;
  }
  return filtered;
}

/**
 * Applies the top-level default `requireApproval` policy to a provider that
 * set no policy of its own. `true` gates every tool except the synthetic
 * `<provider>__list_connections` wrapper; an array gates matching keys with
 * the same lenient semantics as {@link applyDefaultFilter}.
 */
function applyDefaultRequireApproval(
  providerTools: ToolsInput,
  policy: true | string[],
  integrationId: string,
  matchedEntries: Set<string>,
): void {
  const listToolKey = listConnectionsToolKey(integrationId);
  if (policy === true) {
    for (const [key, tool] of Object.entries(providerTools)) {
      if (key === listToolKey) continue;
      (tool as { requireApproval?: boolean }).requireApproval = true;
    }
    return;
  }
  const matchers = policy.map(entry => ({ entry, matches: compileToolMatcher([entry]) }));
  for (const [key, tool] of Object.entries(providerTools)) {
    if (key === listToolKey) continue;
    for (const { entry, matches } of matchers) {
      if (matches(key)) {
        matchedEntries.add(entry);
        (tool as { requireApproval?: boolean }).requireApproval = true;
      }
    }
  }
}

/**
 * Extracts whichever provider tool filter is set. Since `ToolsProviderOptions`
 * is an XOR union and tools() validates co-occurrence up front, at most one
 * of the two will ever be defined here.
 */
function providerFilterOptions(options: ToolsProviderOptions): {
  allowTools?: string[];
  disallowTools?: string[];
} {
  return options.allowTools !== undefined
    ? { allowTools: options.allowTools }
    : options.disallowTools !== undefined
      ? { disallowTools: options.disallowTools }
      : {};
}

/**
 * Applies a per-provider `requireApproval` policy to a checked-in HTTP
 * toolset by marking the selected tools. `true` gates every provider tool
 * (but never the synthetic `<provider>__list_connections` wrapper tool,
 * matching the MCP paths, where only server-discovered tools are gated);
 * an array gates the listed keys — entries containing `*` are globs,
 * expanded against the provider tools minus the synthetic wrapper so a
 * broad glob behaves like `true` — and rejects unknown names and dead
 * globs with the same `invalid_options` error MCP discovery raises, so a
 * typo never silently widens access.
 */
function applyProxyRequireApproval(
  providerTools: ToolsInput,
  integrationId: string,
  requireApproval: boolean | string[] | undefined,
  excludeKeys: string[] = [],
): void {
  if (!requireApproval) return;
  const excluded = new Set(excludeKeys);
  if (requireApproval === true) {
    for (const [toolKey, tool] of Object.entries(providerTools)) {
      if (excluded.has(toolKey)) continue;
      (tool as { requireApproval?: boolean }).requireApproval = true;
    }
    return;
  }
  const known = Object.keys(providerTools);
  const expanded = expandToolPatterns(
    requireApproval,
    known.filter(key => !excluded.has(key)),
    `requireApproval for '${integrationId}'`,
  );
  const unknown = expanded.filter(name => !known.includes(name));
  if (unknown.length > 0) {
    throw new MastraConnectConfigError(
      `Unknown tool name(s) in requireApproval for '${integrationId}': ${unknown.join(', ')}. Known tools: ${known.join(', ')}.`,
    );
  }
  for (const name of expanded) {
    (providerTools[name] as { requireApproval?: boolean }).requireApproval = true;
  }
}

async function discoverMcpTools(input: {
  registration: McpProviderRegistration;
  connectionId: string;
  allowTools?: string[];
  disallowTools?: string[];
  requireApproval?: boolean | string[];
  client: ResolvedClient;
  mcpClients: Map<string, { integrationId: string; connectionId: string; client: MCPClient }>;
  resolverId: number;
}): Promise<ResolvedToolsRecord> {
  const { registration, connectionId, allowTools, disallowTools, requireApproval, client, mcpClients, resolverId } =
    input;
  const requireApprovalFor = Array.isArray(requireApproval) ? compileToolMatcher(requireApproval) : undefined;
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
            // Default: no approval required, matching @mastra/mcp's own
            // default. Opt in with `requireApproval: true` to gate every tool
            // on this provider, or with an array of keys/globs to gate a
            // selection.
            ...(requireApproval === true
              ? { requireToolApproval: true as const }
              : requireApprovalFor
                ? {
                    requireToolApproval: ({ toolName }: { toolName: string }) =>
                      requireApprovalFor(`${registration.integrationId}_${String(toolName)}`),
                  }
                : {}),
          },
        },
      }),
    };
    mcpClients.set(cacheKey, entry);
  }

  const discovery = await entry.client.listToolsWithErrors();
  const error = discovery.errors[registration.integrationId];
  if (error) throw new Error(`MCP tool discovery failed: ${error}`);
  if (Array.isArray(requireApproval)) {
    // Globs that match nothing throw inside the expansion; literal names are
    // validated here against the discovered catalog.
    const expanded = expandToolPatterns(
      requireApproval,
      Object.keys(discovery.tools),
      `requireApproval for '${registration.integrationId}'`,
    );
    const unknown = expanded.filter(name => !(name in discovery.tools));
    if (unknown.length > 0) {
      throw new MastraConnectConfigError(
        `Unknown tool name(s) in requireApproval for '${registration.integrationId}': ${unknown.join(', ')}. Known tools: ${Object.keys(discovery.tools).join(', ')}.`,
      );
    }
  }
  return applyToolFilter(discovery.tools, { allowTools, disallowTools }) as ResolvedToolsRecord;
}
