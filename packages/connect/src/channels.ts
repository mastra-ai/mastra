import type { ConnectClientOptions, ConnectionCredential, ProjectConnection, ResolvedClient } from './client.js';
import { getConnectionContext, getCredential, listProjectConnections, resolveClient } from './client.js';
import { MastraConnectError } from './errors.js';
import type {
  ChannelBuildContext,
  ChannelProviderLike,
  ChannelProviderRegistration,
} from './providers/channel-provider.js';
import { CHANNELS } from './registry.js';
import { groupByIntegrationId, resolveConnection, validateIntegrationOverrides } from './resolution.js';

export interface ChannelsIntegrationOptions {
  /** Pin a specific connection id (bypasses env-var fallback and single-active-connection resolution). */
  connectionId?: string;
  /** Exclude this provider entirely, even if a connection exists. */
  disabled?: boolean;
  /** Provider-specific options merged into the second argument of `ChannelProviderRegistration.build()`. */
  providerOptions?: Record<string, unknown>;
}

export interface ChannelsOptions {
  /** Platform project whose connections to discover. Falls back to MASTRA_PROJECT_ID. */
  projectId?: string;
  /** Optional per-provider overrides keyed by integrationId. */
  integrations?: Record<string, ChannelsIntegrationOptions>;
  client?: ConnectClientOptions;
  /** How long a resolved snapshot stays fresh, in milliseconds. Default 30_000. `0` revalidates every resolution. */
  ttlMs?: number;
}

type ChannelsSnapshot = Record<string, ChannelProviderLike>;

/**
 * Live channel-providers resolver returned by `channels()`. `Mastra({ channels: await channels({ projectId }) })`
 * awaits it as a promise, resolving to the current provider record. Long-lived apps
 * can call `invalidate()`/`refresh()`/`disconnect()` on the returned handle to force
 * re-resolution after a connection is added or a credential rotates.
 */
export interface ChannelsResolver extends PromiseLike<ChannelsSnapshot> {
  /** Explicit call form — same effect as `await`ing the resolver. */
  (): Promise<ChannelsSnapshot>;
  /** Drops the cached snapshot; the next resolution fetches fresh from the platform. */
  invalidate(): void;
  /** Fetches providers from the platform now and updates the cache. Rejects if the platform fetch fails. */
  refresh(): Promise<ChannelsSnapshot>;
  /** Clears the cached snapshot. Reserved for symmetry with `tools()`; currently a no-op beyond invalidation. */
  disconnect(): Promise<void>;
}

const DEFAULT_TTL_MS = 30_000;
/** Minimum wait after a failed platform fetch before another background revalidation. */
const FAILURE_COOLDOWN_MS = 30_000;

/**
 * Returns a live channel-providers resolver over the project's Platform
 * connections. Channel-capable providers (Slack, Telegram, Discord) with an
 * active project connection are materialized into a uniform
 * `Record<string, ChannelProvider>` matching the shape `Mastra({ channels })`
 * already accepts.
 *
 * Configuration errors (missing project id, bad ttlMs, malformed integration
 * id) throw at call time so they surface at startup. Actionable per-integration
 * problems during resolution (needs re-auth, ambiguity, missing peer package)
 * are downgraded to warn-and-skip so one bad integration never takes down the
 * whole map.
 *
 * @example
 * ```ts
 * const mastra = new Mastra({
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

  let cache: { snapshot: ChannelsSnapshot; fetchedAt: number } | undefined;
  let inflight: Promise<ChannelsSnapshot> | undefined;
  let lastFailureAt: number | undefined;

  const buildSnapshot = async (): Promise<ChannelsSnapshot> => {
    let connections: ProjectConnection[];
    try {
      connections = await listProjectConnections(client, projectId);
    } catch (error) {
      lastFailureAt = Date.now();
      throw error;
    }
    const byIntegrationId = groupByIntegrationId(connections);
    const snapshot: ChannelsSnapshot = {};

    for (const registration of CHANNELS) {
      const integrationId = registration.integrationId;
      const overrides = options.integrations?.[integrationId] ?? {};
      if (overrides.disabled) continue;

      const candidates = byIntegrationId.get(integrationId) ?? [];
      if (candidates.length === 0) continue;

      const connectionId = resolveConnection(
        { integrationId, envVar: registration.envVar, connectionId: overrides.connectionId },
        candidates,
      );
      if (!connectionId) continue; // warned + skipped

      const provider = await buildProvider(registration, connectionId, overrides, client);
      if (!provider) continue; // warned + skipped

      snapshot[integrationId] = provider;
    }

    lastFailureAt = undefined;
    return snapshot;
  };

  const refresh = (): Promise<ChannelsSnapshot> => {
    if (!inflight) {
      inflight = (async () => {
        try {
          const snapshot = await buildSnapshot();
          cache = { snapshot, fetchedAt: Date.now() };
          return snapshot;
        } finally {
          inflight = undefined;
        }
      })();
    }
    return inflight;
  };

  const resolve = async (): Promise<ChannelsSnapshot> => {
    if (cache && Date.now() - cache.fetchedAt < ttlMs) {
      return cache.snapshot;
    }
    if (cache) {
      const staleSnapshot = cache.snapshot;
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
      return staleSnapshot;
    }
    return refresh();
  };

  const invocable = (() => resolve()) as ChannelsResolver;
  invocable.invalidate = (): void => {
    cache = undefined;
  };
  invocable.refresh = refresh;
  invocable.disconnect = async (): Promise<void> => {
    cache = undefined;
  };
  // Thenable so `await channels({...})` resolves to the snapshot.
  (invocable as unknown as { then: PromiseLike<ChannelsSnapshot>['then'] }).then = ((onfulfilled, onrejected) =>
    resolve().then(onfulfilled as any, onrejected as any)) as PromiseLike<ChannelsSnapshot>['then'];
  return invocable;
}

async function buildProvider(
  registration: ChannelProviderRegistration,
  connectionId: string,
  overrides: ChannelsIntegrationOptions,
  client: ResolvedClient,
): Promise<ChannelProviderLike | undefined> {
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
