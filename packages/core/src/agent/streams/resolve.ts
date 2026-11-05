import type { MastraServerCache } from '../../cache/base';
import { InMemoryServerCache } from '../../cache/inmemory';
import { CachingPubSub } from '../../events/caching-pubsub';
import type { PubSub } from '../../events/pubsub';
import { isRunLocalTopic } from '../../events/topics';

export interface ResolveRunBusInput {
  /** The agent's own bus (user-provided, or the default). */
  agentBus: PubSub;
  /** Whether `agentBus` was provided by the user. */
  hasCustomBus: boolean;
  /** The Mastra-level bus, once the agent is registered. */
  sharedBus?: PubSub;
  /**
   * Whether run frames must live on `sharedBus` even when the user provided
   * `agentBus` (steps publish from any worker). Only called when `sharedBus`
   * is set and `agentBus` is the user's, so it may resolve state that needs
   * registration.
   */
  requiresSharedBus: () => boolean;
  warn: (message: string) => void;
}

/**
 * The bus a run's frames live on. A registered agent publishes on `sharedBus`
 * so other Mastra instances on that bus can observe its runs. A user-provided
 * `agentBus` takes precedence unless the run's steps publish on `sharedBus`.
 * Unregistered agents keep their own bus.
 */
export function resolveRunBus({
  agentBus,
  hasCustomBus,
  sharedBus,
  requiresSharedBus,
  warn,
}: ResolveRunBusInput): PubSub {
  if (!sharedBus) return agentBus;
  if (!hasCustomBus) return sharedBus;
  if (!requiresSharedBus()) return agentBus;
  if (sharedBus.__rawBus() !== agentBus.__rawBus()) {
    warn(
      `Evented run frames use the Mastra pubsub, not the agent-level 'pubsub', because evented steps publish there.`,
    );
  }
  return sharedBus;
}

export interface ResolveAgentStreamBusInput {
  /** The bus run frames are published on (see {@link resolveRunBus}). */
  runBus: PubSub;
  /** User cache config: `undefined` inherits, `false` disables replay. */
  cache?: MastraServerCache | false;
  /** User per-topic cache policy. */
  shouldCache?: (topic: string) => boolean;
  /** The Mastra-level cache, once the agent is registered. */
  serverCache?: MastraServerCache;
  /**
   * Whether run frames must share `serverCache` because other processes
   * append to the same log. Only called when `serverCache` differs from the
   * resolved cache, so it may resolve state that needs registration.
   */
  requiresServerCache: () => boolean;
  warn: (message: string) => void;
}

export interface ResolvedAgentStreamBus {
  /** The bus to publish and subscribe run frames on. */
  pubsub: PubSub;
  /** The replay cache backing `pubsub`, or `null` when replay is disabled. */
  cache: MastraServerCache | null;
}

/**
 * Resolve the bus an agent publishes run frames on and the replay cache
 * behind it.
 */
export function resolveAgentStreamBus({
  runBus,
  cache,
  shouldCache,
  serverCache,
  requiresServerCache,
  warn,
}: ResolveAgentStreamBusInput): ResolvedAgentStreamBus {
  if (cache === false) {
    // Caching explicitly disabled. Run frames still travel on the run bus
    // (the Mastra transport on the evented engine, where steps publish from
    // any worker), so caching off must not also change the route.
    return { pubsub: runBus, cache: null };
  }

  if (runBus instanceof CachingPubSub) {
    // The bus a run's frames live on is already wrapped. This happens when the
    // user passes a CachingPubSub to `new Mastra({ pubsub })` (or to the agent
    // directly, standalone). Wrapping it again in a second CachingPubSub over
    // the same cache would store every frame twice — once per layer, with
    // consecutive indices — so observe()/replay would deliver the buffered
    // prefix doubled (issue #18148). Reuse the instance instead.
    if (shouldCache) {
      // The existing wrapper owns the caching policy; a per-agent filter
      // cannot be applied without double-wrapping, so it is ignored.
      warn(
        `'shouldCache' is ignored because the configured pubsub is already a CachingPubSub. Pass 'shouldCache' to that CachingPubSub instead.`,
      );
    }
    return { pubsub: runBus, cache: runBus.getCache() };
  }

  // Resolve cache: user-provided > mastra's cache > default InMemoryServerCache
  let resolvedCache = cache ?? serverCache ?? new InMemoryServerCache();

  // On the evented engine, step frames are appended by the StepExecutor,
  // which only knows `mastra.serverCache`. A different agent cache would
  // give the same run two logs with independent indices: an observer
  // advancing on lifecycle events could then drop step frames whose
  // indices sit below its cursor. One run means one log, so the shared
  // cache wins for run frames. `serverCache` is checked first so a no-op
  // comparison never resolves the engine: resolving before registration
  // would memoize 'default' while the agent is not registered yet.
  if (serverCache && resolvedCache !== serverCache && requiresServerCache()) {
    warn(
      `'cache' is not used for evented run frames; they use mastra.serverCache so step frames and observers share one log.`,
    );
    resolvedCache = serverCache;
  }

  // Run-local topics must never reach the cache. This wrapper sits *above*
  // the `mastra.pubsub` proxy that tags publishes `localOnly`, so that flag
  // is set too late for `CachingPubSub` to observe it — the policy has to be
  // declared here instead. Without it, per-run `workflow.events.v2.*` watch
  // events (cumulative step results, often megabytes) are RPUSHed into a
  // shared store that no other instance can ever read from (issue #20646).
  return {
    pubsub: new CachingPubSub(runBus, resolvedCache, {
      shouldCache: topic => !isRunLocalTopic(topic) && (shouldCache?.(topic) ?? true),
    }),
    cache: resolvedCache,
  };
}
