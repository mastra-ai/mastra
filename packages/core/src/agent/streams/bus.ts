import type { MastraServerCache } from '../../cache/base';
import { InMemoryServerCache } from '../../cache/inmemory';
import { CachingPubSub } from '../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { PubSub } from '../../events/pubsub';
import { DEFAULT_STREAM_CLEANUP_TIMEOUT_MS } from './constants';
import { resolveAgentStreamBus, resolveRunBus } from './resolve';
import type { ResolvedAgentStreamBus } from './resolve';
import type { AgentStreamsConfig } from './types';

/**
 * Hooks an {@link AgentStreamBus} reads its owner's runtime state through.
 * The bus keeps no process-specific state of its own.
 */
export interface AgentStreamBusHooks {
  /** The Mastra-level bus and cache, once the owner is registered. */
  getMastra: () => { pubsub: PubSub; serverCache?: MastraServerCache } | undefined;
  /** The owner's default execution mode; wrappers select their own mode per run. */
  usesSharedRunLog: () => boolean;
  warn: (message: string) => void;
}

/** Runs `cleanup` after `timeoutMs`. A timeout of 0 keeps run state forever, so nothing is scheduled. */
export function scheduleStreamCleanup(
  timeoutMs: number,
  cleanup: () => void,
): ReturnType<typeof setTimeout> | undefined {
  if (timeoutMs === 0) return undefined;
  const timer = setTimeout(cleanup, timeoutMs);
  timer.unref?.();
  return timer;
}

/**
 * The resumable stream layer of an agent: the bus its run frames are
 * published on and the replay cache that lets readers reconnect from an
 * offset. Resolution is lazy so a registered agent inherits Mastra's bus and
 * cache.
 */
export class AgentStreamBus {
  readonly #hooks: AgentStreamBusHooks;
  readonly #config: AgentStreamsConfig;
  /** Whether the user explicitly provided a pubsub (don't override with mastra.pubsub) */
  readonly #hasCustomPubsub: boolean;
  /** Inner pubsub (before CachingPubSub wrapper) */
  #innerPubsub: PubSub;
  /** User-provided cache (undefined = inherit from mastra, false = disabled) */
  readonly #cacheConfig: MastraServerCache | false | undefined;
  /** User-supplied per-topic cache policy */
  readonly #shouldCache: ((topic: string) => boolean) | undefined;
  /** Timeout for auto-cleanup after a stream finishes (0 = disabled) */
  readonly #cleanupTimeoutMs: number;
  /** Native/default and evented executions may use different transport/cache pairs. */
  readonly #resolved = new Map<boolean, ResolvedAgentStreamBus>();
  /** Record cache for an unregistered agent with replay off. */
  #localRecordCache: MastraServerCache | undefined;

  constructor(config: AgentStreamsConfig, hooks: AgentStreamBusHooks, defaultPubsub?: PubSub) {
    this.#config = config;
    this.#hooks = hooks;
    this.#hasCustomPubsub = !!config.pubsub;
    this.#innerPubsub = config.pubsub ?? defaultPubsub ?? new EventEmitterPubSub();
    this.#cacheConfig = config.cache;
    this.#shouldCache = config.shouldCache;
    this.#cleanupTimeoutMs = config.cleanupTimeoutMs ?? DEFAULT_STREAM_CLEANUP_TIMEOUT_MS;
  }

  /** Isolate explicit wrapper settings without changing the native Agent's bus. */
  withConfig(config: AgentStreamsConfig): AgentStreamBus {
    return new AgentStreamBus(
      { ...this.#config, ...Object.fromEntries(Object.entries(config).filter(([, value]) => value !== undefined)) },
      this.#hooks,
      this.#innerPubsub,
    );
  }

  /** The owner's default run transport, including replay when enabled. */
  get pubsub(): PubSub {
    return this.forRun(this.#hooks.usesSharedRunLog()).pubsub;
  }

  /** The owner's default replay cache, or `null` when replay is disabled. */
  get cache(): MastraServerCache | null {
    return this.forRun(this.#hooks.usesSharedRunLog()).cache;
  }

  /** Ownership records follow the same cache as the run's replay history. */
  get runRecordCache(): MastraServerCache {
    return this.getRunRecordCache(this.#hooks.usesSharedRunLog());
  }

  getRunRecordCache(usesSharedRunLog: boolean): MastraServerCache {
    return (
      this.forRun(usesSharedRunLog).cache ??
      this.#hooks.getMastra()?.serverCache ??
      (this.#localRecordCache ??= new InMemoryServerCache())
    );
  }

  /** Grace period before a finished run's state is cleaned up (0 = never). */
  get cleanupTimeoutMs(): number {
    return this.#cleanupTimeoutMs;
  }

  /** Runs `cleanup` once the grace period passes. Returns no timer when cleanup is disabled. */
  scheduleCleanup(cleanup: () => void): ReturnType<typeof setTimeout> | undefined {
    return scheduleStreamCleanup(this.#cleanupTimeoutMs, cleanup);
  }

  /** Re-resolve transports initialized before Mastra registration. */
  registerMastra(mastraPubsub: PubSub): void {
    if (this.#cacheConfig === false && this.#resolved.size) this.#resolved.clear();
    if (!this.#hasCustomPubsub && !this.#resolved.size) this.#innerPubsub = mastraPubsub;
    for (const resolved of this.#resolved.values()) {
      if (resolved.pubsub instanceof CachingPubSub && resolved.pubsub.getInner() !== mastraPubsub) {
        this.#resolved.clear();
        break;
      }
    }
  }

  /** Select the run's log without changing the owner's default routing policy. */
  forRun(usesSharedRunLog: boolean): ResolvedAgentStreamBus {
    const existing = this.#resolved.get(usesSharedRunLog);
    if (existing) return existing;
    const mastra = this.#hooks.getMastra();
    const requiresSharedBus = () => usesSharedRunLog;
    const resolved = resolveAgentStreamBus({
      runBus: resolveRunBus({
        agentBus: this.#innerPubsub,
        hasCustomBus: this.#hasCustomPubsub,
        sharedBus: mastra?.pubsub,
        requiresSharedBus,
        warn: this.#hooks.warn,
      }),
      cache: this.#cacheConfig,
      shouldCache: this.#shouldCache,
      serverCache: mastra?.serverCache,
      requiresServerCache: requiresSharedBus,
      warn: this.#hooks.warn,
    });
    this.#resolved.set(usesSharedRunLog, resolved);
    return resolved;
  }
}
