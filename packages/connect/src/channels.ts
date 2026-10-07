import type { ChannelProvider } from '@mastra/core/channels';

import type { ConnectClientOptions, ProjectConnection } from './client.js';
import { getConnectionContext, getCredential, listProjectConnections, resolveClient } from './client.js';
import { MastraConnectError } from './errors.js';
import type { ChannelInstance, ChannelProviderRegistration, ChannelRuntime } from './providers/channel-provider.js';
import type {
  DiscordReservedProviderOption,
  SlackReservedProviderOption,
  TeamsReservedProviderOption,
  TelegramReservedProviderOption,
} from './providers/channels.js';
import { CHANNELS } from './registry.js';
import { groupByIntegrationId, validateProviderIds } from './resolution.js';

type ApiRoute = ReturnType<ChannelProvider['getRoutes']>[number];

/**
 * `providerOptions` fields that `channels()` refuses to forward to a
 * `ChannelProvider` constructor. Marking them `never` here makes the compiler
 * reject them at the call site; the resolver also strips them at runtime with
 * a warning as a defensive layer.
 *
 * Two categories, applied per integration:
 *
 * - **Credentials.** The whole point of `channels()` is that the credential
 *   comes from the platform connection. Passing another `refreshToken` /
 *   `botToken` via `providerOptions` would silently override the connection
 *   (and thereby bypass rotation, revocation, and auditing).
 * - **Framework-managed.** `baseUrl` is derived from the Mastra server config
 *   so webhook URLs match the actually-bound host. `encryptionKey` is a
 *   process-wide at-rest secret sourced from `MASTRA_ENCRYPTION_KEY`; letting
 *   `providerOptions` override it per integration would fragment the
 *   encryption boundary.
 */
type ForbidReservedOptions<Reserved extends string> = { [K in Reserved]?: never };

/** Per-integration `providerOptions` shapes with reserved fields disallowed. */
export type SlackChannelsProviderOptions = Record<string, unknown> & ForbidReservedOptions<SlackReservedProviderOption>;
export type TelegramChannelsProviderOptions = Record<string, unknown> &
  ForbidReservedOptions<TelegramReservedProviderOption>;
export type DiscordChannelsProviderOptions = Record<string, unknown> & {
  applicationId?: string;
  publicKey?: string;
} & ForbidReservedOptions<DiscordReservedProviderOption>;
export type TeamsChannelsProviderOptions = Record<string, unknown> & ForbidReservedOptions<TeamsReservedProviderOption>;

/** Base shape shared by every integration override; per-id specializations narrow `providerOptions`. */
export interface ChannelsProviderOptions<ProviderOptions = Record<string, unknown>> {
  /** Pin a specific connection id (bypasses single-active-connection resolution). */
  connectionId?: string;
  /** Provider-specific options merged into the first argument of `ChannelProviderRegistration.create()`. */
  providerOptions?: ProviderOptions;
}

/**
 * Per-provider configuration map, typed per known channel id. `true` enables
 * a channel with default options and `false` excludes it, mirroring the
 * `tools()` shorthand. Unknown ids are allowed with a generic option shape so
 * future channels don't need a type change here.
 *
 * `slack` is accepted as an alias for `slack-channels` (the platform keys the
 * Slack channel `slack-channels` because `slack` names the Slack tools
 * provider); setting both keys throws.
 */
export interface ChannelsProviders {
  slack?: boolean | ChannelsProviderOptions<SlackChannelsProviderOptions>;
  'slack-channels'?: boolean | ChannelsProviderOptions<SlackChannelsProviderOptions>;
  telegram?: boolean | ChannelsProviderOptions<TelegramChannelsProviderOptions>;
  discord?: boolean | ChannelsProviderOptions<DiscordChannelsProviderOptions>;
  'microsoft-teams'?: boolean | ChannelsProviderOptions<TeamsChannelsProviderOptions>;
  [integrationId: string]: boolean | ChannelsProviderOptions | undefined;
}

export interface ChannelsOptions {
  /** Platform project whose connections to discover. Falls back to MASTRA_PROJECT_ID. */
  projectId?: string;
  /**
   * Which channels to resolve, in one of two shapes:
   * - `["discord", "telegram"]` — an allowlist: only the listed channels are
   *   constructed and mounted.
   * - `{ discord: true, telegram: { connectionId: "..." }, slack: false }` —
   *   per-channel configuration. Every registered channel still resolves
   *   unless excluded: `true` (or `{}`) enables with defaults, `false`
   *   excludes, and an options object pins a connection or passes
   *   provider-specific options.
   *
   * `slack` is an alias for the platform's `slack-channels` key; both spell
   * the same channel in either shape, and naming it twice throws.
   *
   * Omit the option entirely to resolve every registered channel.
   */
  providers?: string[] | ChannelsProviders;
  client?: ConnectClientOptions;
  /** How long a resolved snapshot stays fresh, in milliseconds. Default 30_000. `0` revalidates every resolution. */
  ttlMs?: number;
}

/**
 * The result of resolving a project's connections into a
 * `ChannelProvider` map: providers with an active connection, keyed by
 * integrationId.
 */
export type ResolvedChannels = Record<string, ChannelProvider>;

/**
 * Callback context passed to the resolver when invoked with a runtime
 * context. Mirrors `@mastra/core`'s `ChannelsResolverContext` — Mastra passes
 * `{ mastra }` from `resolveChannels()`; the resolver currently doesn't vary
 * output by context.
 */
export interface ChannelsResolverContext {
  requestContext?: unknown;
  mastra?: unknown;
}

/**
 * The value `channels()` resolves to. Satisfies `@mastra/core`'s
 * `ChannelsResolver` contract, so it can be handed to
 * `new Mastra({ channels })` directly:
 *
 * - Callable — returns the current `Record<string, ChannelProvider>` of
 *   providers with an active connection. Mastra invokes it via
 *   `resolveChannels()`; the TTL cache makes repeat calls cheap.
 * - `getRoutes()` — the union of routes for every non-disabled channel,
 *   available synchronously so Mastra can mount them at construction. Routes
 *   exist before (and after) their integration has an active connection.
 * - Handles — `refresh()` / `disconnect()` control the resolver's private
 *   cache; `refresh()` forces a platform fetch now.
 */
export interface ChannelsResolver {
  /** Returns the current provider map for providers with an active connection. */
  (context?: ChannelsResolverContext): Promise<ResolvedChannels>;
  /** Union of API routes for every non-disabled channel integration. */
  getRoutes(): ApiRoute[];
  /** Fetches connections from the platform now and updates the cache. Rejects if the platform fetch fails. */
  refresh(): Promise<ResolvedChannels>;
  /** Clears the cached snapshot. Reserved for symmetry with `tools()`; currently a no-op beyond invalidation. */
  disconnect(): Promise<void>;
}

const DEFAULT_TTL_MS = 30_000;
/** Minimum wait after a failed platform fetch before another background revalidation. */
const FAILURE_COOLDOWN_MS = 30_000;

/** One registration's long-lived provider plus its currently-selected connection. */
interface IntegrationState {
  registration: ChannelProviderRegistration;
  instance: ChannelInstance;
  /** Selected active connection id, updated on every resolution. `undefined` = no active connection. */
  connectionId: string | undefined;
}

/**
 * Returns a live channels resolver over the project's Platform connections,
 * ready to hand to `new Mastra({ channels: await channels({...}) })`.
 *
 * Provider instances for every channel-capable integration (Slack, Telegram,
 * Discord) are constructed once, up front and credential-less, so their
 * webhook/OAuth routes can mount at Mastra construction. Each resolution
 * fetches the project's connections and late-binds credentials into the live
 * instances: providers with an active connection appear in the resolved
 * map, others don't — so connecting a new channel on the platform takes
 * effect without redeploying the app.
 *
 * Configuration errors (missing project id, bad ttlMs, malformed integration
 * id) reject at call time so they surface at startup. Actionable
 * per-integration problems (provider construction failure, needs re-auth,
 * ambiguity, credential sync failure) are downgraded to warn-and-skip so one
 * bad integration never takes down the whole map.
 *
 * @example
 * ```ts
 * import { Mastra } from '@mastra/core/mastra';
 * import { channels } from '@mastra/connect';
 *
 * export const mastra = new Mastra({
 *   agents: { pat },
 *   channels: await channels({ projectId }),
 * });
 * ```
 */
export async function channels(options: ChannelsOptions = {}): Promise<ChannelsResolver> {
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
  const { overrides: providerOverrides, only } = normalizeChannelProviders(options.providers);
  validateProviderIds(providerOverrides);
  // A channel id that no registration ships for is a typo: silently mounting
  // nothing would hide it forever, so throw at channels() time. Excluded
  // entries are harmless no-ops and stay allowed.
  const knownChannelIds = new Set(CHANNELS.map(registration => registration.integrationId));
  const unknownChannelIds = Object.keys(providerOverrides).filter(
    integrationId => !knownChannelIds.has(integrationId) && !providerOverrides[integrationId]?.disabled,
  );
  if (unknownChannelIds.length > 0) {
    throw new MastraConnectError(
      'invalid_options',
      `Unknown channel${unknownChannelIds.length > 1 ? 's' : ''} in the providers option: ${unknownChannelIds.map(id => `'${id}'`).join(', ')}. Known channels: ${[...knownChannelIds].join(', ')}.`,
    );
  }

  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const client = resolveClient(options.client);

  // Construct long-lived provider instances up front (dynamic package import
  // + credential-less constructor; no platform calls) so `getRoutes()` is
  // synchronous and the instances survive across resolutions.
  const states: IntegrationState[] = [];
  for (const registration of CHANNELS) {
    if (only !== undefined && !only.has(registration.integrationId)) continue;
    const overrides = providerOverrides[registration.integrationId] ?? {};
    if (overrides.disabled) continue;

    const state: IntegrationState = { registration, instance: undefined as never, connectionId: undefined };
    const runtime: ChannelRuntime = {
      client,
      getConnectionId: () => state.connectionId,
      getCredential: async () => {
        const connectionId = state.connectionId;
        if (!connectionId) {
          throw new MastraConnectError(
            'no_active_connection',
            `No active ${registration.integrationId} connection for project ${projectId}. Connect one on the platform, then retry.`,
          );
        }
        return getCredential(client, connectionId);
      },
      getConnectionContext: async () => {
        const connectionId = state.connectionId;
        if (!connectionId) return undefined;
        try {
          return await getConnectionContext(client, connectionId);
        } catch {
          // Metadata is optional; providers that need it will surface the miss.
          return undefined;
        }
      },
    };
    try {
      state.instance = await registration.create(overrides.providerOptions ?? {}, runtime);
    } catch (error) {
      // Warn-and-skip so one broken integration (e.g. a failed module load)
      // never takes down the others. The skipped channel gets no routes and
      // never appears in the resolved map.
      console.warn(
        `[@mastra/connect] Skipping ${registration.integrationId} channel: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }
    states.push(state);
  }

  let cache: { providers: ResolvedChannels; fetchedAt: number } | undefined;
  let inflight: Promise<ResolvedChannels> | undefined;
  let lastFailureAt: number | undefined;
  // `slack` was the Slack channel key before 0.6; it now backs the generated
  // Slack tools while `slack-channels` powers the channel. Warn once per
  // resolver instance if a project still has an active legacy `slack`
  // connection and no `slack-channels` connection, so upgraders aren't left
  // with a silently missing Slack channel.
  let warnedStaleSlackConnection = false;

  const buildSnapshot = async (): Promise<ResolvedChannels> => {
    let connections: ProjectConnection[];
    try {
      connections = await listProjectConnections(client, projectId);
    } catch (error) {
      lastFailureAt = Date.now();
      throw error;
    }
    const byIntegrationId = groupByIntegrationId(connections);
    const providers: ResolvedChannels = {};

    if (
      !warnedStaleSlackConnection &&
      states.some(state => state.registration.integrationId === 'slack-channels') &&
      (byIntegrationId.get('slack')?.length ?? 0) > 0 &&
      (byIntegrationId.get('slack-channels')?.length ?? 0) === 0
    ) {
      warnedStaleSlackConnection = true;
      console.warn(
        `[@mastra/connect] Project ${projectId} has an active 'slack' connection but no 'slack-channels' connection: the Slack channel is now keyed off 'slack-channels'. Connect Slack again as 'slack-channels' to restore it; the existing 'slack' connection still powers the generated Slack tools.`,
      );
    }

    for (const state of states) {
      const integrationId = state.registration.integrationId;
      const overrides = providerOverrides[integrationId] ?? {};
      const candidates = byIntegrationId.get(integrationId) ?? [];

      const connectionId =
        candidates.length === 0
          ? undefined
          : selectChannelConnection(integrationId, overrides.connectionId, candidates);
      // Update the runtime view first: the provider's lazy credential fetches
      // (e.g. Slack's tokenResolver) read this on their next call. When the
      // connection is gone we exclude the provider from the map but never
      // clear its credentials — clearing is destructive on some providers
      // (Discord deletes the stored app config) and live installations keep
      // working from provider-managed storage.
      state.connectionId = connectionId;
      if (!connectionId) continue; // warned + skipped (or simply not connected)

      if (state.instance.sync) {
        try {
          await state.instance.sync();
        } catch (error) {
          console.warn(
            `[@mastra/connect] Skipping ${integrationId} channel: ${error instanceof Error ? error.message : String(error)}`,
          );
          continue;
        }
      }

      providers[integrationId] = state.instance.provider;
    }

    lastFailureAt = undefined;
    return providers;
  };

  const refresh = (): Promise<ResolvedChannels> => {
    if (!inflight) {
      inflight = (async () => {
        try {
          const providers = await buildSnapshot();
          cache = { providers, fetchedAt: Date.now() };
          return providers;
        } finally {
          inflight = undefined;
        }
      })();
    }
    return inflight;
  };

  const resolve = async (): Promise<ResolvedChannels> => {
    if (cache && Date.now() - cache.fetchedAt < ttlMs) {
      return cache.providers;
    }
    if (cache) {
      const stale = cache.providers;
      const inCooldown = lastFailureAt !== undefined && Date.now() - lastFailureAt < FAILURE_COOLDOWN_MS;
      if (!inCooldown && !inflight) {
        const staleFetchedAt = cache.fetchedAt;
        void refresh().catch((error: unknown) => {
          console.warn(
            `[@mastra/connect] Keeping cached channels (fetched ${Date.now() - staleFetchedAt}ms ago); platform refresh failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        });
      }
      return stale;
    }
    return refresh();
  };

  // The context is accepted for the core `ChannelsResolver` contract; output
  // doesn't vary by context (channel resolution is instance-scoped).
  const invocable = ((_context?: ChannelsResolverContext) => resolve()) as ChannelsResolver;
  invocable.getRoutes = (): ApiRoute[] => states.flatMap(state => state.instance.provider.getRoutes());
  invocable.refresh = refresh;
  invocable.disconnect = async (): Promise<void> => {
    cache = undefined;
  };
  return invocable;
}

/**
 * Internal per-channel options: the public shape plus the exclusion marker
 * that the `false` shorthand expands to.
 */
type NormalizedChannelsProviderOptions = ChannelsProviderOptions & { disabled?: boolean };

/** Internal normalization of the `providers` option. */
interface NormalizedChannelProviders {
  /** Per-channel options with boolean shorthands expanded. */
  overrides: Record<string, NormalizedChannelsProviderOptions>;
  /**
   * Set when the array form was used: only these channels are constructed.
   * The record form never restricts — unlisted channels keep resolving.
   */
  only: Set<string> | undefined;
}

/**
 * Friendly channel-key aliases. The Slack channel is keyed `slack-channels`
 * on the platform (plain `slack` names the Slack tools provider), but inside
 * a channels() config `slack` is unambiguous — accept it and canonicalize to
 * the platform key for registration and connection lookup.
 */
const CHANNEL_KEY_ALIASES: Record<string, string> = { slack: 'slack-channels' };

const canonicalChannelId = (id: string): string => CHANNEL_KEY_ALIASES[id] ?? id;

/** Throws when two option keys (e.g. `slack` and `slack-channels`) name the same channel. */
function rejectAliasCollision(sourceKeys: Record<string, string>, canonical: string, key: string): void {
  const existing = sourceKeys[canonical];
  if (existing === undefined) return;
  throw new MastraConnectError(
    'invalid_options',
    existing === key
      ? `Duplicate provider '${key}' in providers array.`
      : `Both '${existing}' and '${key}' name the '${canonical}' channel in the providers option; use one key.`,
  );
}

/**
 * Turns the two accepted `providers` shapes into the internal form, mirroring
 * `tools()`. The array form becomes an allowlist with default options; the
 * record form expands boolean shorthands (`true` → `{}`, `false` → an
 * internal exclusion marker). Alias keys canonicalize first, so `slack` and
 * `slack-channels` configure the same channel (and collide loudly). Malformed
 * inputs throw at channels() time.
 */
function normalizeChannelProviders(providers: ChannelsOptions['providers']): NormalizedChannelProviders {
  if (providers === undefined) return { overrides: {}, only: undefined };
  const sourceKeys: Record<string, string> = {};
  if (Array.isArray(providers)) {
    const overrides: Record<string, NormalizedChannelsProviderOptions> = {};
    for (const entry of providers) {
      if (typeof entry !== 'string') {
        throw new MastraConnectError(
          'invalid_options',
          `Invalid providers entry: expected a string channel id, got ${typeof entry}.`,
        );
      }
      const canonical = canonicalChannelId(entry);
      rejectAliasCollision(sourceKeys, canonical, entry);
      sourceKeys[canonical] = entry;
      overrides[canonical] = {};
    }
    return { overrides, only: new Set(Object.keys(overrides)) };
  }
  const overrides: Record<string, NormalizedChannelsProviderOptions> = {};
  for (const [providerId, value] of Object.entries(providers)) {
    if (value === undefined) continue;
    const canonical = canonicalChannelId(providerId);
    rejectAliasCollision(sourceKeys, canonical, providerId);
    sourceKeys[canonical] = providerId;
    if (value === true) {
      overrides[canonical] = {};
    } else if (value === false) {
      overrides[canonical] = { disabled: true };
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      overrides[canonical] = value;
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
 * Selects the connection `channels()` should use for one provider.
 *
 * - Pinned `connectionId` (from `providers.<id>.connectionId`) wins, but is
 *   skipped if the pinned id isn't attached to the project or the connection
 *   isn't `active`.
 * - Otherwise, the single active connection is used.
 * - When more than one active connection exists, this warns naming the chosen
 *   id and picks the first active connection. There is no env-var fallback;
 *   pin explicitly with `providers.<id>.connectionId` when the deterministic
 *   choice matters.
 */
function selectChannelConnection(
  integrationId: string,
  pinnedId: string | undefined,
  candidates: ProjectConnection[],
): string | undefined {
  const directed = pinnedId?.trim() || undefined;
  if (directed) {
    const match = candidates.find(connection => connection.id === directed);
    if (!match) {
      console.warn(
        `[@mastra/connect] Skipping ${integrationId} channel: pinned connection ${directed} is not attached to this project.`,
      );
      return undefined;
    }
    if (match.status === 'needs_reauth') {
      console.warn(`[@mastra/connect] Skipping ${integrationId} channel: connection ${directed} needs re-auth.`);
      return undefined;
    }
    if (match.status !== 'active') {
      console.warn(
        `[@mastra/connect] Skipping ${integrationId} channel: connection ${directed} is not active (status '${match.status}').`,
      );
      return undefined;
    }
    return directed;
  }

  const active = candidates.filter(connection => connection.status === 'active');
  if (active.length === 0) {
    console.warn(
      `[@mastra/connect] Skipping ${integrationId} channel: no active connections (found ${candidates.length} in other states).`,
    );
    return undefined;
  }
  if (active.length === 1) return active[0]!.id;

  const chosen = active[0]!.id;
  const others = active
    .slice(1)
    .map(connection => connection.id)
    .join(', ');
  console.warn(
    `[@mastra/connect] ${integrationId} channel: found ${active.length} active connections; using ${chosen}. Ignoring ${others}. Pin one with providers.${integrationId}.connectionId to silence this warning.`,
  );
  return chosen;
}
