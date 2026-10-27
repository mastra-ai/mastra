import type { MastraServerCache } from '../../cache/base';
import { CachingPubSub } from '../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../events/event-emitter';
import type { PubSub } from '../../events/pubsub';
import { DEFAULT_STREAM_CLEANUP_TIMEOUT_MS } from './constants';
import { resolveAgentStreamBus, resolveRunBus } from './resolve';
import type { AgentStreamsConfig } from './types';

/**
 * Hooks an {@link AgentStreamBus} reads its owner's runtime state through.
 * The bus keeps no process-specific state of its own.
 */
export interface AgentStreamBusHooks {
  /** The Mastra-level bus and cache, once the owner is registered. */
  getMastra: () => { pubsub: PubSub; serverCache?: MastraServerCache } | undefined;
  /**
   * Whether run frames must live on the Mastra bus and its cache because the
   * run's steps publish from any worker. Only called once the owner is
   * registered.
   */
  usesSharedRunLog: () => boolean;
  warn: (message: string) => void;
}

/**
 * The resumable stream layer of an agent: the bus its run frames are
 * published on and the replay cache that lets readers reconnect from an
 * offset. Resolution is lazy so a registered agent inherits Mastra's bus and
 * cache.
 */
/** Runs `cleanup` after `timeoutMs`. A timeout of 0 keeps run state forever, so nothing is scheduled. */
export function scheduleStreamCleanup(
  timeoutMs: number,
  cleanup: () => void,
): ReturnType<typeof setTimeout> | undefined {
  if (timeoutMs === 0) return undefined;
  return setTimeout(cleanup, timeoutMs);
}

export class AgentStreamBus {
  readonly #hooks: AgentStreamBusHooks;
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
  /** Resolved bus (lazily initialized) */
  #pubsub: PubSub | null = null;
  /** Resolved cache instance (lazily initialized) */
  #cache: MastraServerCache | null = null;

  constructor(config: AgentStreamsConfig, hooks: AgentStreamBusHooks) {
    this.#hooks = hooks;
    this.#hasCustomPubsub = !!config.pubsub;
    this.#innerPubsub = config.pubsub ?? new EventEmitterPubSub();
    this.#cacheConfig = config.cache;
    this.#shouldCache = config.shouldCache;
    this.#cleanupTimeoutMs = config.cleanupTimeoutMs ?? DEFAULT_STREAM_CLEANUP_TIMEOUT_MS;
  }

  /**
   * The bus to publish and subscribe run frames on: a CachingPubSub when
   * replay is enabled, otherwise the run bus itself.
   */
  get pubsub(): PubSub {
    this.#ensureResolved();
    return this.#pubsub!;
  }

  /** The replay cache, or `null` when replay is disabled. */
  get cache(): MastraServerCache | null {
    this.#ensureResolved();
    return this.#cache;
  }

  /** Grace period before a finished run's state is cleaned up (0 = never). */
  get cleanupTimeoutMs(): number {
    return this.#cleanupTimeoutMs;
  }

  /** Runs `cleanup` once the grace period passes. Returns no timer when cleanup is disabled. */
  scheduleCleanup(cleanup: () => void): ReturnType<typeof setTimeout> | undefined {
    return scheduleStreamCleanup(this.#cleanupTimeoutMs, cleanup);
  }

  /**
   * The config a fork of the owner is built with. The pubsub is only passed
   * when the user provided it; a wired Mastra bus is carried over with
   * {@link AgentStreamBus.adoptInnerPubsub} instead.
   */
  get forkConfig(): AgentStreamsConfig {
    return {
      pubsub: this.#hasCustomPubsub ? this.#innerPubsub : undefined,
      cache: this.#cacheConfig,
      cleanupTimeoutMs: this.#cleanupTimeoutMs,
      shouldCache: this.#shouldCache,
    };
  }

  /** Carry the inner pubsub wired on `source` (e.g. mastra.pubsub) over to this bus. */
  adoptInnerPubsub(source: AgentStreamBus): void {
    this.#innerPubsub = source.#innerPubsub;
  }

  /**
   * Wire Mastra's bus once the owner is registered, so observers subscribing
   * through Mastra see the frames this agent publishes.
   */
  registerMastra(mastraPubsub: PubSub): void {
    // With caching disabled, a bus resolved before registration is the
    // pre-registration run bus; drop it so it is re-resolved against Mastra.
    if (this.#cacheConfig === false && this.#pubsub) {
      this.#reset();
    }

    // Wire mastra.pubsub as the inner pubsub if user didn't provide a custom one.
    // This must happen before CachingPubSub initialization.
    if (!this.#hasCustomPubsub && !this.#pubsub) {
      this.#innerPubsub = mastraPubsub;
    }

    // If the caching wrapper was built before registration it is bound to the
    // pre-registration bus (the default EventEmitterPubSub). Run frames
    // belong on the shared bus, so rebuild the wrapper there. Registration runs
    // before the agent is used, so nothing is subscribed to the old instance.
    if (this.#pubsub instanceof CachingPubSub && this.#pubsub.getInner() !== mastraPubsub) {
      this.#reset();
    }
  }

  #reset(): void {
    this.#pubsub = null;
    this.#cache = null;
  }

  #ensureResolved(): void {
    if (this.#pubsub) return;
    const mastra = this.#hooks.getMastra();
    const resolved = resolveAgentStreamBus({
      runBus: this.#runBus(mastra?.pubsub),
      cache: this.#cacheConfig,
      shouldCache: this.#shouldCache,
      serverCache: mastra?.serverCache,
      requiresServerCache: this.#hooks.usesSharedRunLog,
      warn: this.#hooks.warn,
    });
    this.#pubsub = resolved.pubsub;
    this.#cache = resolved.cache;
  }

  /**
   * The bus a run's frames live on.
   *
   * Once registered, frames go on the Mastra-level bus so any Mastra instance
   * sharing it can observe the run, even if this bus was resolved before
   * registration. Using one bus also means one cache log per run — the
   * property offset replay depends on.
   *
   * A user-provided agent-level pubsub keeps carrying run frames, unless the
   * run's steps execute on whichever worker claims them (evented): then an
   * observer on the agent's own bus would never see them.
   */
  #runBus(sharedBus: PubSub | undefined): PubSub {
    return resolveRunBus({
      agentBus: this.#innerPubsub,
      hasCustomBus: this.#hasCustomPubsub,
      sharedBus,
      requiresSharedBus: this.#hooks.usesSharedRunLog,
      warn: this.#hooks.warn,
    });
  }
}
