import type { ToolsInput } from '@mastra/core/agent';
import { MCPClient } from '@mastra/mcp';

import type { ConnectClientOptions, IntegrationCatalogEntry, ProjectConnection, ResolvedClient } from './client.js';
import {
  listIntegrations,
  listProjectConnections,
  platformMcpTransport,
  resolveClient,
  validateResourceId,
} from './client.js';
import { MastraConnectConfigError, MastraConnectError } from './errors.js';
import {
  buildMcpMultiConnectionTools,
  buildProxyMultiConnectionTools,
  listConnectionsToolKey,
} from './multi-connection.js';
import type { McpProviderRegistration, ProviderRegistration, ProxyProviderRegistration } from './registry.js';
import { PROVIDERS } from './registry.js';
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
  /**
   * Scope resolution to one end user. When set, the resolver returns tools
   * for the project's global connections **plus** the connections created for
   * this resource key, and every platform call made under the scope asserts
   * `x-mastra-resource-id` so the platform can enforce ownership. Omit it to
   * keep today's global-only behavior.
   *
   * Accepts a static key (`tools({ resourceId: userId })` — the per-request
   * pattern `tools: (ctx) => tools({ resourceId: ... })` stays cheap because
   * identical options share one internal state) or a callback derived per
   * resolution from the invocation context. A callback returning `undefined`
   * resolves global-only.
   */
  resourceId?: string | ((ctx?: ToolsResolverContext) => string | undefined | Promise<string | undefined>);
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
export interface ToolsResolver extends Promise<ResolvedToolsRecord> {
  (ctx?: ToolsResolverContext): Promise<ResolvedToolsRecord>;
  /** Fetches tools from the platform now and updates the cache. Rejects if the platform fetch fails. */
  refresh(): Promise<ResolvedToolsRecord>;
  /**
   * Clears the cached snapshots and closes the MCP transports of the state
   * behind this resolver. Resolvers created with identical options share that
   * state, so this disconnects them too — but not permanently: a later
   * resolution rebuilds the state, and already-returned MCP tools reconnect
   * on their next call.
   */
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
}

/**
 * Options accepted by {@link tools}: a static {@link ToolsOptions} object, or
 * a callback — sync or async, reading the per-request context — returning
 * one. The callback form is the preferred way to vary options per request
 * (e.g. role-based `allowTools` / `requireApproval`): it is invoked on every
 * resolution and snapshots are memoized per distinct options value, so
 * requests producing the same options share one cached snapshot with the
 * usual TTL / stale-while-revalidate semantics.
 */
export type ToolsOptionsInput = ToolsOptions | ((ctx?: ToolsResolverContext) => ToolsOptions | Promise<ToolsOptions>);

interface NormalizedRequest {
  registration: ProviderRegistration;
  options: ToolsProviderOptions;
}

const DEFAULT_TTL_MS = 30_000;
/** Minimum wait after a failed platform fetch before another background revalidation. */
const FAILURE_COOLDOWN_MS = 30_000;
/** Maximum resource-scoped snapshots kept per shared state; least recently used evicts first. */
const MAX_RESOURCE_SNAPSHOTS = 50;
/**
 * Grace period after a resource snapshot is evicted before its MCP clients
 * become eligible for disconnect, so an agent call that resolved tools just
 * before eviction does not lose its transport mid-tool-call.
 */
const EVICTION_LINGER_MS = 60_000;
const GLOBAL_SCOPE_KEY = 'global';
let nextResolverId = 0;

type McpClientEntry = { integrationId: string; connectionId: string; client: MCPClient };

/** One cached resolution scope: the global snapshot or one resource's snapshot. */
interface SnapshotScope {
  /** The resource key this scope serves; undefined for the global scope. */
  resourceId: string | undefined;
  /** Resolved client for this scope; asserts `x-mastra-resource-id` when resource-scoped. */
  client: ResolvedClient;
  cache?: { snapshot: ResolvedToolsRecord; fetchedAt: number; mcpKeys: Set<string> };
  inflight?: Promise<ResolvedToolsRecord>;
  lastFailureAt?: number;
  /** LRU clock for resource-scope eviction. The global scope is never evicted. */
  lastUsedAt: number;
}

/**
 * Internal state shared by every `tools()` call with identical (normalized)
 * options, so the per-request pattern `tools: (ctx) => tools({ resourceId })`
 * reuses snapshots and MCP clients instead of churning them. `resourceId`
 * deliberately does not participate in the registry key: it selects a scope
 * inside the shared state.
 */
interface SharedToolsState {
  resolverId: number;
  projectId: string;
  ttlMs: number;
  options: ToolsOptions;
  normalizedProviders: NormalizedProviders;
  /** Keyed by `${integrationId}::${connectionId}`; shared across every scope. */
  mcpClients: Map<string, McpClientEntry>;
  /** Keyed by {@link scopeKey}. */
  scopes: Map<string, SnapshotScope>;
  /**
   * MCP keys from recently evicted resource scopes stay off-limits to the
   * prune until the linger elapses (see {@link EVICTION_LINGER_MS}).
   */
  evictionHolds: { mcpKeys: Set<string>; expiresAt: number }[];
  closing?: Promise<void>;
  /** LRU clock for registry eviction; bumped on every acquire. */
  lastAcquiredAt: number;
}

/**
 * Maximum shared states kept in the registry. Each distinct option set (for
 * example an inline `fetch` closure or a rotated access token) mints one
 * state holding snapshots and open MCP transports; without a bound those
 * accumulate for the life of the process. Least recently acquired evicts
 * first and is disconnected; a resolver still holding an evicted state keeps
 * working — it just refetches and reopens transports on its next resolution.
 */
const MAX_SHARED_STATES = 32;

const sharedStates = new Map<string, SharedToolsState>();
const functionIds = new WeakMap<object, number>();
let nextFunctionId = 0;

/** Stable per-process id for a function identity (custom fetch), for use in the registry key. */
function identityId(fn: object | undefined): number | undefined {
  if (!fn) return undefined;
  let id = functionIds.get(fn);
  if (id === undefined) {
    id = ++nextFunctionId;
    functionIds.set(fn, id);
  }
  return id;
}

/** Deterministic JSON with sorted object keys, so option objects written in any order share a key. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function sharedStateKey(projectId: string, ttlMs: number, options: ToolsOptions): string {
  return stableStringify({
    projectId,
    ttlMs,
    providers: options.providers,
    allowTools: options.allowTools,
    disallowTools: options.disallowTools,
    requireApproval: options.requireApproval,
    client: {
      baseUrl: options.client?.baseUrl,
      orgId: options.client?.orgId,
      accessToken: options.client?.accessToken,
      fetch: identityId(options.client?.fetch),
    },
  });
}

function acquireSharedState(
  projectId: string,
  ttlMs: number,
  options: ToolsOptions,
  normalizedProviders: NormalizedProviders,
): SharedToolsState {
  const key = sharedStateKey(projectId, ttlMs, options);
  let state = sharedStates.get(key);
  if (!state) {
    state = {
      resolverId: ++nextResolverId,
      projectId,
      ttlMs,
      options,
      normalizedProviders,
      mcpClients: new Map(),
      scopes: new Map(),
      evictionHolds: [],
      lastAcquiredAt: Date.now(),
    };
    sharedStates.set(key, state);
    evictSharedStates(key);
  }
  state.lastAcquiredAt = Date.now();
  return state;
}

/** Evicts and disconnects the least recently acquired states beyond the registry bound. */
function evictSharedStates(justAcquiredKey: string): void {
  let excess = sharedStates.size - MAX_SHARED_STATES;
  if (excess <= 0) return;
  const candidates = Array.from(sharedStates.entries())
    .filter(([key]) => key !== justAcquiredKey)
    .sort((a, b) => a[1].lastAcquiredAt - b[1].lastAcquiredAt);
  for (const [key, state] of candidates) {
    if (excess <= 0) break;
    sharedStates.delete(key);
    excess -= 1;
    // The registry shrinks immediately, but a tool record resolved just
    // before eviction may still execute against this state's MCP clients:
    // disconnect after the same grace period MCP-key eviction uses.
    const timer = setTimeout(() => void disconnectState(state).catch(() => {}), EVICTION_LINGER_MS);
    timer.unref?.();
  }
}

/** Test-only: current number of states in the shared registry. */
export function __sharedToolsStateCountForTests(): number {
  return sharedStates.size;
}

/** Test-only: disconnects and forgets every shared resolver state. */
export async function __clearSharedToolsStateForTests(): Promise<void> {
  const states = Array.from(sharedStates.values());
  sharedStates.clear();
  await Promise.allSettled(states.map(state => disconnectState(state)));
}

function scopeKey(resourceId: string | undefined): string {
  return resourceId === undefined ? GLOBAL_SCOPE_KEY : `resource:${resourceId}`;
}

/** Gets or creates the scope for a resource key, touching its LRU clock. */
function acquireScope(state: SharedToolsState, resourceId: string | undefined): SnapshotScope {
  const key = scopeKey(resourceId);
  let scope = state.scopes.get(key);
  if (!scope) {
    scope = {
      resourceId,
      client: resolveClient({
        ...state.options.client,
        projectId: state.projectId,
        ...(resourceId === undefined ? {} : { resourceId }),
      }),
      lastUsedAt: Date.now(),
    };
    state.scopes.set(key, scope);
    if (resourceId !== undefined) evictResourceScopes(state);
  }
  scope.lastUsedAt = Date.now();
  return scope;
}

/**
 * Bounds the per-resource snapshot map. Evicted scopes' MCP keys get a
 * linger hold so transports stay alive for calls resolved just before
 * eviction; a timer re-runs the prune once the hold expires. Scopes with a
 * fetch in flight are skipped this round.
 */
function evictResourceScopes(state: SharedToolsState): void {
  const resourceScopes = Array.from(state.scopes.entries()).filter(([key]) => key !== GLOBAL_SCOPE_KEY);
  let excess = resourceScopes.length - MAX_RESOURCE_SNAPSHOTS;
  if (excess <= 0) return;
  resourceScopes.sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt);
  let scheduledPrune = false;
  for (const [key, scope] of resourceScopes) {
    if (excess <= 0) break;
    if (scope.inflight) continue;
    state.scopes.delete(key);
    excess -= 1;
    if (scope.cache && scope.cache.mcpKeys.size > 0) {
      state.evictionHolds.push({ mcpKeys: scope.cache.mcpKeys, expiresAt: Date.now() + EVICTION_LINGER_MS });
      if (!scheduledPrune) {
        scheduledPrune = true;
        const timer = setTimeout(() => void pruneStaleMcpClients(state), EVICTION_LINGER_MS + 10);
        timer.unref?.();
      }
    }
  }
}

/**
 * Disconnects MCP clients no longer referenced by any scope's current
 * snapshot or by an unexpired eviction hold. Runs after every snapshot
 * refresh (a connection removed on the platform drops its transport, as
 * before) and when eviction holds expire.
 */
async function pruneStaleMcpClients(state: SharedToolsState): Promise<void> {
  if (state.closing) return;
  const now = Date.now();
  state.evictionHolds = state.evictionHolds.filter(hold => hold.expiresAt > now);
  const active = new Set<string>();
  for (const scope of state.scopes.values()) {
    for (const key of scope.cache?.mcpKeys ?? []) active.add(key);
  }
  for (const hold of state.evictionHolds) {
    for (const key of hold.mcpKeys) active.add(key);
  }
  const stale = Array.from(state.mcpClients.entries()).filter(([key]) => !active.has(key));
  for (const [key] of stale) state.mcpClients.delete(key);
  await Promise.allSettled(stale.map(([, entry]) => entry.client.disconnect()));
}

/**
 * Loads the connection list and the integration catalog for one scope. A
 * catalog failure only matters when an active connection needs catalog-backed
 * MCP discovery; otherwise checked-in HTTP providers resolve with an empty
 * catalog.
 */
async function loadSnapshotInputs(
  state: SharedToolsState,
  client: ResolvedClient,
): Promise<{ connections: ProjectConnection[]; catalog: IntegrationCatalogEntry[]; catalogAvailable: boolean }> {
  const [connectionsResult, catalogResult] = await Promise.allSettled([
    listProjectConnections(client, state.projectId),
    listIntegrations(client),
  ]);
  if (connectionsResult.status === 'rejected') throw connectionsResult.reason;
  const connections = connectionsResult.value;
  if (catalogResult.status === 'fulfilled') {
    return { connections, catalog: catalogResult.value, catalogAvailable: true };
  }

  const { overrides, only } = state.normalizedProviders;
  const checkedIn = new Set(PROVIDERS.map(registration => registration.integrationId));
  const needsCatalog = connections.some(
    connection =>
      connection.status === 'active' &&
      !checkedIn.has(connection.integrationId) &&
      !overrides[connection.integrationId]?.disabled &&
      (only === undefined || only.has(connection.integrationId)),
  );
  if (needsCatalog) throw catalogResult.reason;
  const reason = catalogResult.reason;
  console.warn(
    `[@mastra/connect] Platform catalog unavailable (${reason instanceof Error ? reason.message : String(reason)}); resolving checked-in providers only.`,
  );
  return { connections, catalog: [], catalogAvailable: false };
}

/**
 * Fetches a fresh snapshot for one scope, deduplicating concurrent calls per
 * scope. Rejects on failure. A refresh requested while the state is closing
 * starts after the close completes (against a freshly acquired scope, since
 * closing clears the scope map).
 */
function refreshScope(state: SharedToolsState, scope: SnapshotScope): Promise<ResolvedToolsRecord> {
  if (state.closing) {
    return state.closing.then(() => refreshScope(state, acquireScope(state, scope.resourceId)));
  }
  if (!scope.inflight) {
    scope.inflight = (async () => {
      try {
        const { connections, catalog, catalogAvailable } = await loadSnapshotInputs(state, scope.client);
        const requests = buildRequests(state.normalizedProviders, catalog, catalogAvailable);
        const clientOptions: ConnectClientOptions = {
          ...state.options.client,
          projectId: state.projectId,
          ...(scope.resourceId === undefined ? {} : { resourceId: scope.resourceId }),
        };
        const { record, mcpKeys } = await mapTools(
          connections,
          requests,
          state.options,
          clientOptions,
          scope.client,
          state.mcpClients,
          state.resolverId,
        );
        scope.cache = { snapshot: record, fetchedAt: Date.now(), mcpKeys };
        scope.lastFailureAt = undefined;
        await pruneStaleMcpClients(state);
        return record;
      } catch (error) {
        scope.lastFailureAt = Date.now();
        throw error;
      } finally {
        scope.inflight = undefined;
      }
    })();
  }
  return scope.inflight;
}

/** Serves a scope's snapshot: fresh from cache, stale with background revalidation, or a blocking first fetch. */
async function resolveScope(state: SharedToolsState, resourceId: string | undefined): Promise<ResolvedToolsRecord> {
  const scope = acquireScope(state, resourceId);
  if (scope.cache && Date.now() - scope.cache.fetchedAt < state.ttlMs) {
    return scope.cache.snapshot;
  }
  if (scope.cache) {
    // Stale: serve the snapshot now and revalidate in the background,
    // swallowing (but warning about) fetch failures. During a sustained
    // platform outage the cooldown keeps this to one request per window
    // instead of one per agent call.
    const staleSnapshot = scope.cache.snapshot;
    const inCooldown = scope.lastFailureAt !== undefined && Date.now() - scope.lastFailureAt < FAILURE_COOLDOWN_MS;
    if (!inCooldown && !scope.inflight && !state.closing) {
      const staleFetchedAt = scope.cache.fetchedAt;
      void refreshScope(state, scope).catch((error: unknown) => {
        console.warn(
          `[@mastra/connect] Keeping cached tools (fetched ${Date.now() - staleFetchedAt}ms ago); platform refresh failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      });
    }
    return staleSnapshot;
  }
  return refreshScope(state, scope);
}

/**
 * Closes every MCP transport and clears every cached snapshot in the shared
 * state. Any refresh in progress settles first so it cannot repopulate the
 * cache or register an MCP client after cleanup; refreshes requested
 * meanwhile wait for the close and start afterwards. The state stays usable:
 * the next resolution fetches fresh.
 */
function disconnectState(state: SharedToolsState): Promise<void> {
  state.closing ??= (async () => {
    try {
      let pending = Array.from(state.scopes.values(), scope => scope.inflight).filter(Boolean);
      while (pending.length > 0) {
        await Promise.allSettled(pending);
        pending = Array.from(state.scopes.values(), scope => scope.inflight).filter(Boolean);
      }
      state.scopes.clear();
      state.evictionHolds = [];
      const clients = Array.from(state.mcpClients.values(), entry => entry.client);
      state.mcpClients.clear();
      await Promise.allSettled(clients.map(mcp => mcp.disconnect()));
    } finally {
      state.closing = undefined;
    }
  })();
  return state.closing;
}

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
 *
 * Pass a callback instead of an options object to vary options per request
 * (see {@link ToolsOptionsInput}). With the callback form, configuration
 * validation runs at the first resolution that produces a given options
 * value — still failing loudly — instead of at call time.
 */
export function tools(options: ToolsOptionsInput = {}): ToolsResolver {
  if (typeof options === 'function') return dynamicTools(options);
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

  // Resource scope belongs on ToolsOptions so it stays out of the shared-state
  // key; a client-level key would silently fork the snapshot/MCP state.
  if (options.client?.resourceId !== undefined) {
    throw new MastraConnectError(
      'invalid_options',
      'Set resourceId on the tools() options (tools({ resourceId })), not on client.resourceId.',
    );
  }
  const resourceIdOption = options.resourceId;
  if (
    resourceIdOption !== undefined &&
    typeof resourceIdOption !== 'string' &&
    typeof resourceIdOption !== 'function'
  ) {
    throw new MastraConnectError(
      'invalid_options',
      `Invalid resourceId: expected a string or a function, got ${typeof resourceIdOption}.`,
    );
  }
  // A malformed static key fails here — at startup — not at first resolution.
  const staticResourceId = typeof resourceIdOption === 'string' ? validateResourceId(resourceIdOption) : undefined;

  // Fail fast on unresolvable client config (missing access token) while
  // forcing project attribution to match the project whose connections this
  // resolver discovers. Each resource scope adds its assertion header later.
  resolveClient({ ...options.client, projectId });
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

  const state = acquireSharedState(projectId, ttlMs, options, normalizedProviders);

  const validateDynamicResourceId = (raw: string | undefined): string | undefined =>
    raw === undefined || raw === null ? undefined : validateResourceId(raw);

  // A callback resourceId forces a microtask before the scope is known; the
  // static/global paths stay synchronous-start so a refresh kicked off by a
  // resolution cannot be overtaken by a disconnect issued in the same tick.
  const resolve = (ctx?: ToolsResolverContext): Promise<ResolvedToolsRecord> => {
    if (typeof resourceIdOption === 'function') {
      return Promise.resolve(resourceIdOption(ctx)).then(raw => resolveScope(state, validateDynamicResourceId(raw)));
    }
    return resolveScope(state, staticResourceId);
  };

  const resolver: ToolsResolver = finalizeResolver(
    // Promise-shaped (separate assign source: a thenable spread into an object
    // literal trips no-misused-promises) so `tools: (ctx) => tools({ ... })`
    // satisfies core's `Promise<ToolsInput>`-typed dynamic argument: core
    // awaits the returned value, which unwraps the resolver into the current
    // tool record (resolved without an invocation context).
    Object.assign(resolve, promiseSurface(resolve), {
      refresh: (): Promise<ResolvedToolsRecord> => {
        if (typeof resourceIdOption === 'function') {
          return Promise.resolve(resourceIdOption(undefined)).then(raw => {
            const resourceId = validateDynamicResourceId(raw);
            return refreshScope(state, acquireScope(state, resourceId));
          });
        }
        return refreshScope(state, acquireScope(state, staticResourceId));
      },
      disconnect: (): Promise<void> => disconnectState(state),
      with: (extra: ToolsWithInput): ToolsResolver => withExtraTools(resolver, extra),
    }),
  );
  return resolver;
}

/**
 * The Promise surface shared by every resolver shape. Each method resolves
 * fresh, so `await resolver` always reflects the current snapshot.
 */
function promiseSurface(resolve: () => Promise<ResolvedToolsRecord>): {
  then: Promise<ResolvedToolsRecord>['then'];
  catch: Promise<ResolvedToolsRecord>['catch'];
  finally: Promise<ResolvedToolsRecord>['finally'];
} {
  return {
    then: (onFulfilled?, onRejected?) => resolve().then(onFulfilled, onRejected),
    catch: onRejected => resolve().catch(onRejected),
    finally: onFinally => resolve().finally(onFinally),
  };
}

/**
 * Adds the `Symbol.toStringTag` the Promise interface requires. Done with
 * `defineProperty` because async functions carry a non-writable inherited
 * tag ('AsyncFunction') that a plain assignment would throw on.
 */
function finalizeResolver(resolver: Omit<ToolsResolver, typeof Symbol.toStringTag>): ToolsResolver {
  Object.defineProperty(resolver, Symbol.toStringTag, { value: 'ToolsResolver', configurable: true });
  return resolver as ToolsResolver;
}

/**
 * Most distinct options values a callback-form resolver keeps live caches
 * (and MCP clients) for at once. Callbacks are expected to produce a small,
 * closed set of option shapes (one per role, say); the cap exists so a
 * callback that accidentally derives options from unbounded per-request data
 * cannot retain an unbounded number of resolver wrappers. Eviction is
 * least-recently-used; the separately bounded shared-state registry owns
 * transport cleanup so resource-only variants cannot disconnect each other.
 */
const MAX_OPTION_VARIANTS = 32;

/**
 * Builds the callback-form resolver: each resolution invokes `getOptions`
 * with the request context, then delegates to a memoized static resolver for
 * that options value, so every distinct options value gets its own snapshot
 * cache with the normal TTL / stale-while-revalidate semantics. Options
 * validation happens when a value is first seen (inside `tools()`), so
 * configuration errors fail that resolution loudly instead of being
 * swallowed.
 */
function dynamicTools(getOptions: (ctx?: ToolsResolverContext) => ToolsOptions | Promise<ToolsOptions>): ToolsResolver {
  interface VariantEntry {
    resolver: ToolsResolver;
  }

  // Insertion order doubles as LRU order: a hit is re-inserted at the tail,
  // so the head is always the least recently used variant.
  const variants = new Map<string, VariantEntry>();
  let closing: Promise<void> | undefined;

  const acquireVariant = async (ctx?: ToolsResolverContext): Promise<VariantEntry> => {
    if (closing) await closing;
    const options = await getOptions(ctx);
    // disconnect() may have started while getOptions was pending; wait for it
    // so this resolution never inserts into the map behind the cleanup's back.
    if (closing) await closing;
    if (typeof options !== 'object' || options === null || Array.isArray(options)) {
      throw new MastraConnectError(
        'invalid_options',
        `The tools() options callback must return a ToolsOptions object, got ${options === null ? 'null' : Array.isArray(options) ? 'an array' : typeof options}.`,
      );
    }
    const key = hashOptions(options);
    const existing = variants.get(key);
    if (existing) {
      variants.delete(key);
      variants.set(key, existing);
      return existing;
    }
    const entry: VariantEntry = { resolver: tools(options) };
    variants.set(key, entry);
    if (variants.size > MAX_OPTION_VARIANTS) {
      const [oldestKey] = variants.entries().next().value!;
      variants.delete(oldestKey);
      console.warn(
        `[@mastra/connect] tools() options callback produced more than ${MAX_OPTION_VARIANTS} distinct options values; evicting the least recently used variant. Derive options from a small, closed set of inputs (e.g. roles), not per-request data.`,
      );
      // Do not disconnect here. Variants that differ only by resourceId share
      // one state, while distinct states are bounded and cleaned up by the
      // shared-state registry.
    }
    return entry;
  };

  const resolve = async (ctx?: ToolsResolverContext): Promise<ResolvedToolsRecord> => {
    const entry = await acquireVariant(ctx);
    return entry.resolver(ctx);
  };

  const resolver: ToolsResolver = finalizeResolver(
    Object.assign(resolve, promiseSurface(resolve), {
      // Without a request there is no context, so refresh targets the variant
      // the callback produces for an absent context — the same one a direct
      // `await resolver()` call uses. Other variants keep their own TTL-based
      // revalidation.
      refresh: async (): Promise<ResolvedToolsRecord> => {
        const entry = await acquireVariant(undefined);
        return entry.resolver.refresh();
      },
      disconnect: (): Promise<void> => {
        closing ??= (async () => {
          try {
            const all = Array.from(variants.values());
            variants.clear();
            await Promise.allSettled(all.map(entry => entry.resolver.disconnect()));
          } finally {
            closing = undefined;
          }
        })();
        return closing;
      },
      with: (extra: ToolsWithInput): ToolsResolver => withExtraTools(resolver, extra),
    }),
  );
  return resolver;
}

/** Identity registry for non-serializable option values (e.g. a custom `client.fetch`). */
const functionIdentity = new WeakMap<object, number>();
let nextFunctionIdentity = 0;

/**
 * Stable key for an options value: JSON with sorted object keys, so two
 * callbacks returning structurally equal options share one cached variant.
 * Functions (and other non-plain values) hash by identity — the same
 * instance maps to the same key, two different instances to different keys —
 * which is the safe direction: at worst a duplicate cache entry, never a
 * false merge of different configurations.
 */
function hashOptions(options: ToolsOptions): string {
  const byIdentity = (value: object): string => {
    let id = functionIdentity.get(value);
    if (id === undefined) {
      id = ++nextFunctionIdentity;
      functionIdentity.set(value, id);
    }
    return `__identity_${id}__`;
  };
  const encode = (value: unknown): unknown => {
    if (value === undefined) return '__undefined__';
    if (typeof value === 'function') return byIdentity(value);
    if (Array.isArray(value)) return value.map(encode);
    if (typeof value === 'object' && value !== null) {
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) return byIdentity(value);
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, entryValue]) => entryValue !== undefined)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([entryKey, entryValue]) => [entryKey, encode(entryValue)]),
      );
    }
    return value;
  };
  return JSON.stringify(encode(options));
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
  const resolver: ToolsResolver = finalizeResolver(
    Object.assign(resolve, promiseSurface(resolve), {
      refresh: async (): Promise<ResolvedToolsRecord> => {
        const [baseTools, extraTools] = await Promise.all([base.refresh(), resolveExtra()]);
        return { ...baseTools, ...extraTools };
      },
      disconnect: (): Promise<void> => base.disconnect(),
      with: (more: ToolsWithInput): ToolsResolver => withExtraTools(resolver, more),
    }),
  );
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

/**
 * Maps one platform connection list snapshot to a flat tool record without
 * allowing ambiguous tool ownership. Returns the `${integrationId}::${connectionId}`
 * keys the snapshot's MCP tools depend on; the caller prunes clients no scope
 * references anymore.
 */
async function mapTools(
  connections: ProjectConnection[],
  requests: NormalizedRequest[],
  options: ToolsOptions,
  // Client options with the resolver's projectId merged in, so the clients the
  // proxy toolsets create at execution time carry the attribution header.
  clientOptions: ConnectClientOptions,
  client: ResolvedClient,
  mcpClients: Map<string, McpClientEntry>,
  resolverId: number,
): Promise<{ record: ResolvedToolsRecord; mcpKeys: Set<string> }> {
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
            client: clientOptions,
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
            client: clientOptions,
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

  return { record: result, mcpKeys: activeMcpKeys };
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
