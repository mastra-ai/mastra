import type { MastraServerCache } from '../cache/base';
import type { IMastraLogger } from '../logger';
import { BatchPolicy } from './batch-policy';
import { PubSub } from './pubsub';
import type { Event, EventCallback, SubscribeOptions } from './types';

/**
 * Options for CachingPubSub
 */
export interface CachingPubSubOptions {
  /**
   * Optional prefix for cache keys to namespace events.
   * Defaults to 'pubsub:'.
   *
   * NOTE: when batching is used and multiple `CachingPubSub` instances share
   * the same underlying cache, each instance MUST set a distinct `keyPrefix`.
   * Pending-index lists and per-subscriber cursors are keyed by
   * `${keyPrefix}${topic}:batch:${subscriberId}:...`, so collisions across
   * instances would cause one subscriber to resume from another's cursor.
   */
  keyPrefix?: string;
  /**
   * Optional logger for structured logging.
   * Falls back to console.error if not provided.
   */
  logger?: IMastraLogger;
}

/**
 * A PubSub decorator that adds event caching and replay capabilities.
 *
 * Wraps any PubSub implementation and uses MastraServerCache to:
 * - Cache all published events per topic
 * - Enable replay of cached events for late subscribers
 *
 * This enables resumable streams - clients can disconnect and reconnect
 * without missing events.
 *
 * @example
 * ```typescript
 * import { EventEmitterPubSub, CachingPubSub } from '@mastra/core/events';
 * import { InMemoryServerCache } from '@mastra/core/cache';
 *
 * const cache = new InMemoryServerCache();
 * const pubsub = new CachingPubSub(new EventEmitterPubSub(), cache);
 *
 * // Subscribe with replay - receives cached events first, then live
 * await pubsub.subscribeWithReplay('my-topic', (event) => {
 *   console.log(event);
 * });
 * ```
 */
export class CachingPubSub extends PubSub {
  private readonly keyPrefix: string;
  private readonly logger?: IMastraLogger;
  /** Maps original callbacks to their wrapped versions for proper unsubscribe */
  private callbackMap = new Map<EventCallback, EventCallback>();
  /**
   * Disposers for cache-backed batching subscriptions, keyed by the original
   * callback. Invoked from `unsubscribe` so policy timers are cleared.
   */
  private batchDisposers = new Map<EventCallback, () => void>();
  /**
   * Per-subscription flush closures for cache-backed batching subscriptions.
   * Keyed by the original callback. `flush()` walks these so a caller-driven
   * flush (e.g. at run completion) force-delivers in-buffer events instead of
   * leaving them stranded until the policy's timer fires.
   */
  private batchFlushers = new Map<EventCallback, () => Promise<void>>();

  constructor(
    private readonly inner: PubSub,
    private readonly cache: MastraServerCache,
    options: CachingPubSubOptions = {},
  ) {
    super();
    this.keyPrefix = options.keyPrefix ?? 'pubsub:';
    this.logger = options.logger;
  }

  /**
   * Log an error message using the configured logger or console.error.
   */
  private logError(message: string, error: unknown): void {
    if (this.logger) {
      this.logger.error(message, error);
    } else {
      console.error(message, error);
    }
  }

  /**
   * Log a warning using the configured logger or console.warn. Used for
   * recoverable conditions like orphaned pending indices after cache eviction.
   */
  private logWarn(message: string, meta?: Record<string, unknown>): void {
    if (this.logger) {
      this.logger.warn(message, meta);
    } else {
      console.warn(message, meta);
    }
  }

  /**
   * Get the cache key for a topic's event list
   */
  private getCacheKey(topic: string): string {
    return `${this.keyPrefix}${topic}`;
  }

  /**
   * Get the cache key for a topic's index counter
   */
  private getCounterKey(topic: string): string {
    return `${this.keyPrefix}${topic}:counter`;
  }

  /**
   * Publish an event to a topic.
   * The event is cached with a sequential index before being published to the inner PubSub.
   *
   * Uses atomic increment for index assignment to prevent race conditions
   * when multiple events are published concurrently.
   */
  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt' | 'index'>): Promise<void> {
    const cacheKey = this.getCacheKey(topic);
    const counterKey = this.getCounterKey(topic);

    let index: number | undefined;
    let indexFailed = false;
    try {
      // Atomically get next index (increment returns value after incrementing, so subtract 1 for 0-based index)
      index = (await this.cache.increment(counterKey)) - 1;
    } catch (error) {
      this.logError(`[CachingPubSub] Failed to increment counter for ${topic}`, error);
      indexFailed = true;
    }

    // On counter failure leave `index` undefined rather than defaulting to 0:
    // batching subscribers key cursors off `index`, and reusing 0 across
    // multiple failures would corrupt the pending list.
    const fullEvent: Event = {
      ...event,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      ...(index !== undefined ? { index } : {}),
    };

    if (!indexFailed) {
      try {
        // Cache BEFORE live publish so late-joining observers never miss events
        await this.cache.listPush(cacheKey, fullEvent);
      } catch (error) {
        this.logError(`[CachingPubSub] Failed to cache event for ${topic}`, error);
      }
    }

    // Always publish to inner PubSub — cache failure must not block live delivery
    await this.inner.publish(topic, fullEvent);
  }

  /**
   * Subscribe to live events on a topic (no replay).
   *
   * When `options.batch` is provided:
   * - If the inner PubSub supports batching natively, delegate to it.
   * - Otherwise, run a cache-backed batching loop using per-subscriber
   *   cursors stored in the cache. This requires `options.batch.subscriberId`
   *   so cursors can be reattached after a restart.
   */
  async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    if (!options?.batch) {
      await this.inner.subscribe(topic, cb, options);
      return;
    }
    if (this.inner.supportsNativeBatching) {
      await this.inner.subscribe(topic, cb, options);
      return;
    }
    await this.subscribeBatched(topic, cb, options);
  }

  /** Cache key for the per-subscriber pending-index list. */
  private getPendingKey(topic: string, subscriberId: string): string {
    return `${this.keyPrefix}${topic}:batch:${subscriberId}:pending`;
  }

  /** Cache key for the per-subscriber cursor (last-delivered index). */
  private getCursorKey(topic: string, subscriberId: string): string {
    return `${this.keyPrefix}${topic}:batch:${subscriberId}:cursor`;
  }

  /**
   * Cache-backed batching path. Used when the inner adapter does not
   * support batching natively. Holds per-subscriber cursors (event
   * indices) in the cache; reads the actual events back from the event
   * log when it's time to flush.
   */
  private async subscribeBatched(topic: string, cb: EventCallback, options: SubscribeOptions): Promise<void> {
    // Durability boundary: the in-memory `pendingIndices` array below is
    // authoritative within this process. The cache mirror is best-effort —
    // `wrappedCb`'s `cache.listPush(pendingKey, index)` runs concurrently
    // with `flushOnce`'s `cache.set(pendingKey, remaining)` and the two
    // writes may interleave at the cache layer. On a hard crash before the
    // next successful flush, rehydration reads whatever the cache last
    // persisted, which may lag in-memory state by one in-flight event. The
    // event itself is still in the event log, but its index may be absent
    // from the persisted pending list.
    const batch = options.batch!;
    const subscriberId = batch.subscriberId;
    if (!subscriberId) {
      throw new Error(
        'CachingPubSub batching requires options.batch.subscriberId for cursor reattachment across restarts',
      );
    }

    const pendingKey = this.getPendingKey(topic, subscriberId);
    const cursorKey = this.getCursorKey(topic, subscriberId);
    const eventCacheKey = this.getCacheKey(topic);

    // Rehydrate any pending cursors persisted from a previous run.
    const rehydrated = (await this.cache.listFromTo(pendingKey, 0)) as number[];
    const pendingIndices: number[] = [...rehydrated];

    const policy = new BatchPolicy(batch);

    // Re-entrancy guard. A second flush call while one is in flight
    // (e.g. an `isImmediate` event arriving mid-cb, or the deadline timer
    // firing during a maxSize-triggered flush) would otherwise run two
    // flush() instances over the same `pendingIndices` snapshot — double
    // delivery and double cursor advance. We serialize: while flushing,
    // record a request and re-run once the current pass completes.
    let flushing = false;
    let queued = false;

    const flushOnce = async (): Promise<void> => {
      // Empty buffer is a true no-op — must not call policy.onFlushed(0)
      // because that bumps lastDeliveredAt and corrupts the minIntervalMs
      // floor for callers that flush() defensively at run boundaries.
      if (pendingIndices.length === 0) return;

      // Snapshot the indices we're about to deliver; subsequent enqueues
      // append to the in-memory list and the cache while we work.
      const toDeliver = pendingIndices.slice();
      const fromIdx = toDeliver[0]!;
      const toIdx = toDeliver[toDeliver.length - 1]!;
      const eventsInRange = (await this.cache.listFromTo(eventCacheKey, fromIdx, toIdx)) as Event[];

      // Filter to only the indices we actually queued (in case the range
      // is non-contiguous).
      const wanted = new Set(toDeliver);
      const events = eventsInRange.filter(e => typeof e.index === 'number' && wanted.has(e.index));

      const { delivered, dropped } = policy.prepareBatch(events);

      // Track the indices that actually settled in this pass — delivered
      // successfully or dropped by coalesce/overflow. We must NOT advance past
      // a cb-errored event just because a higher-indexed event was dropped:
      // that would purge the errored event from the pending list and lose it.
      const settledIndices = new Set<number>();
      let lastDeliveredIndex = -1;
      let deliveredCount = 0;
      for (const ev of delivered) {
        try {
          // ack/nack are not exposed: success advances the cursor, a thrown
          // error leaves the index in the pending list so the range retries
          // on the next flush.
          await (cb(ev, undefined, undefined) as void | Promise<void>);
          if (typeof ev.index === 'number') {
            settledIndices.add(ev.index);
            lastDeliveredIndex = ev.index;
          }
          deliveredCount += 1;
        } catch (err) {
          this.logError(
            `[CachingPubSub] cache-backed batch cb failed for ${topic}/${subscriberId} at index ${ev.index} (id=${ev.id})`,
            err,
          );
          break;
        }
      }
      for (const ev of dropped) {
        if (typeof ev.index === 'number') settledIndices.add(ev.index);
      }

      if (settledIndices.size > 0) {
        const remaining = pendingIndices.filter(i => !settledIndices.has(i));
        pendingIndices.length = 0;
        pendingIndices.push(...remaining);

        try {
          // cursorKey is informational; track the highest contiguously-delivered
          // index. Dropped events leaving holes don't advance the cursor — the
          // pending list is the source of truth for replay-on-startup.
          if (lastDeliveredIndex >= 0) {
            await this.cache.set(cursorKey, lastDeliveredIndex);
          }
          // Atomic replace of the pending list. Held under the `flushing`
          // mutex above, so wrappedCb enqueues cannot interleave with this
          // rewrite; and a single `set` removes the crash-window that
          // `delete + N listPush` used to have.
          await this.cache.set(pendingKey, remaining);
        } catch (err) {
          this.logError(`[CachingPubSub] failed to persist cursor for ${topic}/${subscriberId}`, err);
        }
      }

      // Account for events that exited the queue (delivered + acked-as-dropped).
      // Events that the cb threw on stay queued and stay counted in policy.size.
      const settled = deliveredCount + dropped.length;
      if (settled > 0) {
        policy.onFlushed(settled);
      }
    };

    const flush = async (): Promise<void> => {
      if (flushing) {
        queued = true;
        return;
      }
      flushing = true;
      try {
        await flushOnce();
        // Drain any re-flush requests that arrived during this pass. Loop
        // rather than recurse so we don't blow the stack under churn.
        while (queued) {
          queued = false;
          await flushOnce();
        }
      } finally {
        flushing = false;
      }
    };

    policy.bindFlushHandler(flush);

    // The inner-subscribe wrapper: ack the inner immediately (cache owns
    // retention now), record the index in cache + memory, ask the policy
    // what to do.
    const wrappedCb: EventCallback = (event, innerAck) => {
      // Fire-and-forget; the inner PubSub's subscribe API can't await us.
      // Catch any rejection at the IIFE boundary so a throwing `coalesce`,
      // `isImmediate`, or cache adapter doesn't escape as an unhandled
      // rejection (which would crash under `--unhandled-rejections=strict`).
      void (async () => {
        try {
          await innerAck?.();
        } catch (err) {
          this.logError(`[CachingPubSub] inner ack failed during batched delivery for ${topic}`, err);
        }
        if (typeof event.index !== 'number') {
          // Without an index we can't reattach across restarts. This
          // shouldn't happen — every event published via this CachingPubSub
          // gets an index. Skip rather than poison the cursor list.
          this.logError(
            `[CachingPubSub] received event without index in batched subscriber for ${topic}`,
            new Error('missing index'),
          );
          return;
        }
        pendingIndices.push(event.index);
        try {
          await this.cache.listPush(pendingKey, event.index);
        } catch (err) {
          this.logError(`[CachingPubSub] failed to persist pending index for ${topic}`, err);
        }
        if (policy.onEnqueue(event) === 'flush-now') {
          await flush();
        }
      })().catch(err => {
        this.logError(`[CachingPubSub] batched delivery failed for ${topic}/${subscriberId}`, err);
      });
    };

    this.callbackMap.set(cb, wrappedCb);
    this.batchDisposers.set(cb, () => policy.dispose());
    this.batchFlushers.set(cb, flush);
    await this.inner.subscribe(topic, wrappedCb, { group: options.group });

    // If we rehydrated pending indices from a previous run, replay every
    // one into the policy (not just the head). Pushing N indices into
    // pendingIndices while only ticking policy.size by 1 would desync the
    // policy's bookkeeping from the queue.
    if (rehydrated.length > 0) {
      const rehydratedRange = (await this.cache.listFromTo(
        eventCacheKey,
        rehydrated[0]!,
        rehydrated[rehydrated.length - 1]!,
      )) as Event[];
      const byIndex = new Map<number, Event>();
      for (const ev of rehydratedRange) {
        if (typeof ev.index === 'number') byIndex.set(ev.index, ev);
      }
      let decision: 'flush-now' | 'wait' = 'wait';
      // Collect orphans (pending list outlived the cached event — eviction,
      // TTL, manual truncation) and emit one aggregated warning at the end
      // rather than N warnings, which would spam logs at startup with a
      // stuck cursor.
      const orphans: number[] = [];
      for (const i of rehydrated) {
        const ev = byIndex.get(i);
        if (!ev) {
          orphans.push(i);
          continue;
        }
        if (policy.onEnqueue(ev) === 'flush-now') decision = 'flush-now';
      }
      if (orphans.length > 0) {
        this.logWarn(
          `[CachingPubSub] ${orphans.length} orphaned pending indices for ${topic}/${subscriberId}: cached events missing`,
          {
            topic,
            subscriberId,
            orphanCount: orphans.length,
            firstFew: orphans.slice(0, 5),
          },
        );
      }
      if (decision === 'flush-now') {
        await flush();
      }
    }
  }

  /**
   * Subscribe to a topic with automatic replay of cached events.
   *
   * Order of operations:
   * 1. Subscribe to live events FIRST (to avoid missing events during replay)
   * 2. Fetch and replay cached history
   * 3. Deduplicate events at the boundary using event IDs
   *
   * Each subscriber gets its own deduplication set to ensure
   * multiple subscribers can independently receive all events.
   *
   * NOTE: replay subscribers cannot opt into batching — `SubscribeOptions.batch`
   * is not supported on this method. Combining replay with batching raises
   * ordering questions (do replayed events count toward `maxSize`? do they
   * pass through `coalesce`?) that are out of scope for this primitive.
   */
  async subscribeWithReplay(topic: string, cb: EventCallback): Promise<void> {
    // Each subscriber gets its own seen set for deduplication
    // This prevents the same event from being delivered twice to THIS subscriber
    // (once via cache replay and once via live subscription)
    let seen: Set<string> | null = new Set<string>();

    // Wrap callback to deduplicate events during replay/live overlap.
    // After replay completes, seen is nulled out and the wrapper becomes a passthrough.
    const wrappedCb: EventCallback = (event, ack) => {
      if (seen) {
        if (!seen.has(event.id)) {
          seen.add(event.id);
          cb(event, ack);
        }
      } else {
        cb(event, ack);
      }
    };

    // 1. Subscribe to live events FIRST to avoid race condition
    this.callbackMap.set(cb, wrappedCb);
    await this.inner.subscribe(topic, wrappedCb);

    // 2. Fetch and replay cached history
    const history = await this.getHistory(topic);
    for (const event of history) {
      if (!seen!.has(event.id)) {
        seen!.add(event.id);
        cb(event);
      }
    }

    // Deduplication only needed during replay/live overlap — null out to free memory
    // and skip unnecessary has/add for all subsequent live events
    seen = null;
  }

  /**
   * Subscribe to a topic with replay starting from a specific index.
   * More efficient than full replay when the client knows their last position.
   *
   * Like {@link subscribeWithReplay}, batching is not supported on this
   * method.
   *
   * @param topic - The topic to subscribe to
   * @param offset - Start replaying from this index (0-based)
   * @param cb - Callback invoked for each event
   */
  async subscribeFromOffset(topic: string, offset: number, cb: EventCallback): Promise<void> {
    // Each subscriber gets its own seen set for deduplication
    let seen: Set<string> | null = new Set<string>();

    // Wrap callback to deduplicate events during replay/live overlap.
    // After replay completes, seen is nulled out and the wrapper becomes a passthrough.
    const wrappedCb: EventCallback = (event, ack) => {
      if (seen) {
        if (!seen.has(event.id)) {
          seen.add(event.id);
          cb(event, ack);
        }
      } else {
        cb(event, ack);
      }
    };

    // 1. Subscribe to live events FIRST to avoid race condition
    this.callbackMap.set(cb, wrappedCb);
    await this.inner.subscribe(topic, wrappedCb);

    // 2. Fetch and replay cached history FROM the specified index
    const history = await this.getHistory(topic, offset);
    for (const event of history) {
      if (!seen!.has(event.id)) {
        seen!.add(event.id);
        cb(event);
      }
    }

    // Deduplication only needed during replay/live overlap — null out to free memory
    seen = null;
  }

  /**
   * Unsubscribe from a topic.
   */
  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    const wrappedCb = this.callbackMap.get(cb) ?? cb;
    this.callbackMap.delete(cb);
    const disposer = this.batchDisposers.get(cb);
    if (disposer) {
      disposer();
      this.batchDisposers.delete(cb);
    }
    this.batchFlushers.delete(cb);
    await this.inner.unsubscribe(topic, wrappedCb);
  }

  /**
   * Get historical events for a topic from cache.
   */
  async getHistory(topic: string, offset: number = 0): Promise<Event[]> {
    const cacheKey = this.getCacheKey(topic);
    const events = await this.cache.listFromTo(cacheKey, offset);
    return events as Event[];
  }

  /**
   * Flush any pending operations.
   *
   * Drains every cache-backed batching subscription's in-flight buffer
   * before delegating to the inner PubSub. Without this, callers using
   * `flush()` to force-deliver pending signals at run boundaries would
   * see events stranded in `pendingIndices` until the policy's timer
   * fired — which on shutdown means never.
   */
  async flush(): Promise<void> {
    if (this.batchFlushers.size > 0) {
      const flushes = [...this.batchFlushers.values()].map(fn => fn());
      await Promise.allSettled(flushes);
    }
    await this.inner.flush();
  }

  /**
   * Clear cached events for a specific topic.
   * Call this when a stream completes to free memory.
   * Also clears the index counter.
   */
  async clearTopic(topic: string): Promise<void> {
    const cacheKey = this.getCacheKey(topic);
    const counterKey = this.getCounterKey(topic);
    await Promise.all([this.cache.delete(cacheKey), this.cache.delete(counterKey)]);
  }

  /**
   * Get the inner PubSub instance.
   * Useful for accessing implementation-specific methods like close().
   */
  getInner(): PubSub {
    return this.inner;
  }
}

/**
 * Factory function to wrap a PubSub with caching capabilities.
 *
 * @example
 * ```typescript
 * import { withCaching, EventEmitterPubSub } from '@mastra/core/events';
 * import { InMemoryServerCache } from '@mastra/core/cache';
 *
 * const cache = new InMemoryServerCache();
 * const pubsub = withCaching(new EventEmitterPubSub(), cache);
 * ```
 */
export function withCaching(pubsub: PubSub, cache: MastraServerCache, options?: CachingPubSubOptions): CachingPubSub {
  return new CachingPubSub(pubsub, cache, options);
}
