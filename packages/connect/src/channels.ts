import type { ChannelProvider } from '@mastra/core/channels';

import type { ConnectClientOptions, ProjectConnection } from './client.js';
import { getConnectionContext, getCredential, listProjectConnections, resolveClient } from './client.js';
import { MastraConnectError } from './errors.js';
import type { ChannelInstance, ChannelProviderRegistration, ChannelRuntime } from './providers/channel-provider.js';
import type {
  DiscordReservedProviderOption,
  SlackReservedProviderOption,
  TelegramReservedProviderOption,
} from './providers/channels.js';
import { CHANNELS } from './registry.js';
import { groupByIntegrationId, validateIntegrationOverrides } from './resolution.js';

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

/** Base shape shared by every integration override; per-id specializations narrow `providerOptions`. */
export interface ChannelsIntegrationOptions<ProviderOptions = Record<string, unknown>> {
  /** Pin a specific connection id (bypasses single-active-connection resolution). */
  connectionId?: string;
  /** Exclude this provider entirely — no instance is constructed and no routes are mounted. */
  disabled?: boolean;
  /** Provider-specific options merged into the first argument of `ChannelProviderRegistration.create()`. */
  providerOptions?: ProviderOptions;
}

/**
 * Integration overrides map, typed per known channel id. Unknown ids are
 * allowed with a generic option shape so future channels don't need a type
 * change here.
 */
export interface ChannelsIntegrationOverrides {
  slack?: ChannelsIntegrationOptions<SlackChannelsProviderOptions>;
  telegram?: ChannelsIntegrationOptions<TelegramChannelsProviderOptions>;
  discord?: ChannelsIntegrationOptions<DiscordChannelsProviderOptions>;
  [integrationId: string]: ChannelsIntegrationOptions | undefined;
}

export interface ChannelsOptions {
  /** Platform project whose connections to discover. Falls back to MASTRA_PROJECT_ID. */
  projectId?: string;
  /** Optional per-provider overrides keyed by integrationId. */
  integrations?: ChannelsIntegrationOverrides;
  client?: ConnectClientOptions;
  /** How long a resolved snapshot stays fresh, in milliseconds. Default 30_000. `0` revalidates every resolution. */
  ttlMs?: number;
}

/**
 * The result of resolving a project's connections into a
 * `ChannelProvider` map: integrations with an active connection, keyed by
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
 *   integrations with an active connection. Mastra invokes it via
 *   `resolveChannels()`; the TTL cache makes repeat calls cheap.
 * - `getRoutes()` — the union of routes for every non-disabled channel,
 *   available synchronously so Mastra can mount them at construction. Routes
 *   exist before (and after) their integration has an active connection.
 * - Handles — `invalidate()` / `refresh()` / `disconnect()` control the
 *   resolver's private cache; `refresh()` forces a platform fetch now.
 */
export interface ChannelsResolver {
  /** Returns the current provider map for integrations with an active connection. */
  (context?: ChannelsResolverContext): Promise<ResolvedChannels>;
  /** Union of API routes for every non-disabled channel integration. */
  getRoutes(): ApiRoute[];
  /** Drops the cached snapshot; the next resolution fetches fresh from the platform. */
  invalidate(): void;
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
 * instances: integrations with an active connection appear in the resolved
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
  validateIntegrationOverrides(options.integrations);

  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const client = resolveClient(options.client);

  // Construct long-lived provider instances up front (dynamic package import
  // + credential-less constructor; no platform calls) so `getRoutes()` is
  // synchronous and the instances survive across resolutions.
  const states: IntegrationState[] = [];
  for (const registration of CHANNELS) {
    const overrides = options.integrations?.[registration.integrationId] ?? {};
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

    for (const state of states) {
      const integrationId = state.registration.integrationId;
      const overrides = options.integrations?.[integrationId] ?? {};
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
  invocable.invalidate = (): void => {
    cache = undefined;
  };
  invocable.refresh = refresh;
  invocable.disconnect = async (): Promise<void> => {
    cache = undefined;
  };
  return invocable;
}

/**
 * Selects the connection `channels()` should use for one provider.
 *
 * - Pinned `connectionId` (from `integrations.<id>.connectionId`) wins, but is
 *   skipped if the pinned id isn't attached to the project or the connection
 *   isn't `active`.
 * - Otherwise, the single active connection is used.
 * - When more than one active connection exists, this warns naming the chosen
 *   id and picks the first active connection. There is no env-var fallback;
 *   pin explicitly with `integrations.<id>.connectionId` when the deterministic
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
    `[@mastra/connect] ${integrationId} channel: found ${active.length} active connections; using ${chosen}. Ignoring ${others}. Pin one with integrations.${integrationId}.connectionId to silence this warning.`,
  );
  return chosen;
}
