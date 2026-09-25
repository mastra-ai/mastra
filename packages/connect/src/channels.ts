import type { ChannelProvider } from '@mastra/core/channels';

import type { ConnectClientOptions, ConnectionCredential, ProjectConnection, ResolvedClient } from './client.js';
import { getConnectionContext, getCredential, listProjectConnections, resolveClient } from './client.js';
import { MastraConnectError } from './errors.js';
import type { ChannelBuildContext, ChannelProviderRegistration } from './providers/channel-provider.js';
import type {
  DiscordReservedProviderOption,
  SlackReservedProviderOption,
  TelegramReservedProviderOption,
} from './providers/channels.js';
import { CHANNELS } from './registry.js';
import { groupByIntegrationId, validateIntegrationOverrides } from './resolution.js';

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
  /** Exclude this provider entirely, even if a connection exists. */
  disabled?: boolean;
  /** Provider-specific options merged into the second argument of `ChannelProviderRegistration.build()`. */
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
 * `ChannelProvider` map. Assignable directly to `Mastra({ channels })`.
 */
export type ResolvedChannels = Record<string, ChannelProvider>;

/**
 * Callback context passed to `channels()`'s resolver when invoked with a
 * runtime context. Mirrors the shape used by `tools()` and other dynamic
 * agent fields — currently unused (per-request provider variance isn't
 * modeled here) but kept for signature symmetry.
 */
export interface ChannelsResolverContext {
  requestContext?: unknown;
  mastra?: unknown;
}

/**
 * The value returned by `channels()`. Symmetric with `tools()`:
 *
 * - Thenable — `await channels({ projectId })` yields a
 *   `Record<string, ChannelProvider>` directly, ready to hand to
 *   `new Mastra({ channels: await channels({ projectId }) })`.
 * - Callable — `channels(opts)(ctx)` returns the same
 *   `Record<string, ChannelProvider>`; identical to `await channels(opts)`.
 * - Handles — `invalidate()` / `refresh()` / `disconnect()` scope to the
 *   resolver's private cache only. `Mastra({ channels })` reads the
 *   `Record<string, ChannelProvider>` **synchronously** at construction time,
 *   so the constructed Mastra instance will not pick up newly-added
 *   connections or rotated credentials without a restart. These handles are
 *   for standalone/test usage where the resolver is being called directly —
 *   not for the Mastra-registered snapshot.
 */
export interface ChannelsResolver extends PromiseLike<ResolvedChannels> {
  /** Callable form used for symmetry with `tools()`; returns the resolved map. */
  (context?: ChannelsResolverContext): Promise<ResolvedChannels>;
  /** Drops the cached snapshot; the next resolution fetches fresh from the platform. */
  invalidate(): void;
  /** Fetches providers from the platform now and updates the cache. Rejects if the platform fetch fails. */
  refresh(): Promise<ResolvedChannels>;
  /** Clears the cached snapshot. Reserved for symmetry with `tools()`; currently a no-op beyond invalidation. */
  disconnect(): Promise<void>;
}

const DEFAULT_TTL_MS = 30_000;
/** Minimum wait after a failed platform fetch before another background revalidation. */
const FAILURE_COOLDOWN_MS = 30_000;

/**
 * Returns a live channels resolver over the project's Platform connections.
 * Channel-capable integrations (Slack, Telegram, Discord) with an active
 * project connection are materialized into `ChannelProvider` instances ready
 * to hand to `new Mastra({ channels: await channels({...}) })`.
 *
 * Configuration errors (missing project id, bad ttlMs, malformed integration
 * id) throw at call time so they surface at startup. Actionable per-integration
 * problems during resolution (needs re-auth, ambiguity, provider build failure)
 * are downgraded to warn-and-skip so one bad integration never takes down the
 * whole map.
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
export function channels(options: ChannelsOptions = {}): ChannelsResolver {
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

    for (const registration of CHANNELS) {
      const integrationId = registration.integrationId;
      const overrides = options.integrations?.[integrationId] ?? {};
      if (overrides.disabled) continue;

      const candidates = byIntegrationId.get(integrationId) ?? [];
      if (candidates.length === 0) continue;

      const connectionId = selectChannelConnection(integrationId, overrides.connectionId, candidates);
      if (!connectionId) continue; // warned + skipped

      const provider = await buildProvider(registration, connectionId, overrides, client);
      if (!provider) continue; // warned + skipped

      providers[integrationId] = provider;
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

  // Kept callable for signature symmetry with `tools()`; the context is
  // ignored (per-request provider variance isn't modeled here).
  const invocable = ((_context?: ChannelsResolverContext) => resolve()) as ChannelsResolver;
  invocable.invalidate = (): void => {
    cache = undefined;
  };
  invocable.refresh = refresh;
  invocable.disconnect = async (): Promise<void> => {
    cache = undefined;
  };
  // Thenable so `await channels({...})` resolves to the map directly.
  (invocable as unknown as { then: PromiseLike<ResolvedChannels>['then'] }).then = ((onfulfilled, onrejected) =>
    resolve().then(onfulfilled as never, onrejected as never)) as PromiseLike<ResolvedChannels>['then'];
  return invocable;
}

async function buildProvider(
  registration: ChannelProviderRegistration,
  connectionId: string,
  overrides: ChannelsIntegrationOptions,
  client: ResolvedClient,
): Promise<ChannelProvider | undefined> {
  let credential: ConnectionCredential;
  try {
    credential = await getCredential(client, connectionId);
  } catch (error) {
    console.warn(
      `[@mastra/connect] Skipping ${registration.integrationId} channel: ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }

  let context: ChannelBuildContext = { connectionId, client };
  try {
    const connectionContext = await getConnectionContext(client, connectionId);
    context = { connectionId, client, context: connectionContext };
  } catch {
    // Metadata is optional; providers that need it will surface the miss.
  }

  try {
    return await registration.build(credential, overrides.providerOptions ?? {}, context);
  } catch (error) {
    console.warn(
      `[@mastra/connect] Skipping ${registration.integrationId} channel: ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }
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
