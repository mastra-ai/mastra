import type { MastraServerCache } from '../cache/base';
import type { IMastraLogger } from '../logger';
import { isLeaseProvider, PubSub } from './pubsub';
import type { LeaseProvider } from './pubsub';
import type { Event, EventCallback, SubscribeOptions } from './types';

/**
 * Options for CachingPubSub
 */
export interface CachingPubSubOptions {
  /**
   * Optional prefix for cache keys to namespace events.
   * Defaults to 'pubsub:'.
   */
  keyPrefix?: string;
  /**
   * Optional logger for structured logging.
   * Falls back to console.error if not provided.
   */
  logger?: IMastraLogger;
  /**
   * Optional per-topic caching policy. Defaults to caching every topic.
   *
   * Returning `false` takes the same path as a `localOnly` publish: no list
   * entry, no index, no counter allocation — the event is handed straight to
   * the inner PubSub and still delivered live.
   *
   * This exists because `localOnly` is not always visible here. When a caller
   * wraps a PubSub that itself decides `localOnly` (e.g. the `mastra.pubsub`
   * proxy), the cache runs *above* that decision and never sees the flag, so
   * the policy has to be supplied at construction time instead.
   */
  shouldCache?: (topic: string) => boolean;
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
 * ## One append path
 *
 * Every cached publish goes through {@link MastraServerCache.listPushIndexed}:
 * one atomic operation that allocates the frame's index and appends it. The
 * cache list is therefore the run's log — position and index always agree —
 * and the transport only carries the live tail of that log. Subscribers hold a
 * single integer cursor and backfill any gap they observe from the log rather
 * than relying on transport replay.
 *
 * A cache that cannot append atomically cannot back a numbered stream, so
 * {@link CachingPubSub} publishes unnumbered (live-only) events through it:
 * delivery still works, but `offset` replay is unavailable because there is no
 * ordering to replay from.
 *
 * ## Batching
 *
 * `CachingPubSub` is transparent to `options.batch`: `subscribe()` forwards
 * the option to the inner PubSub, and `supportsNativeBatching` mirrors the
 * inner's value. Wrapping a non-native inner with `{ batch: {...} }` results
 * in unbatched delivery — use an inner that returns
 * `supportsNativeBatching === true` (e.g. `EventEmitterPubSub`) if you need
 * batched delivery.
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
  private readonly shouldCache?: (topic: string) => boolean;
  /** Maps original callbacks to their wrapped versions for proper unsubscribe */
  private callbackMap = new Map<EventCallback, EventCallback>();

  constructor(
    private readonly inner: PubSub,
    private readonly cache: MastraServerCache,
    options: CachingPubSubOptions = {},
  ) {
    super();
    this.keyPrefix = options.keyPrefix ?? 'pubsub:';
    this.logger = options.logger;
    this.shouldCache = options.shouldCache;
  }

  /** Unwrap to the inner transport so capability checks see through this decorator. */
  override __rawBus(): PubSub {
    return this.inner.__rawBus();
  }

  get supportsNativeBatching(): boolean {
    return this.inner.supportsNativeBatching;
  }

  get supportsOffsets(): boolean {
    return true;
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
   * Log a warning using the configured logger or console.warn.
   */
  private logWarn(message: string): void {
    if (this.logger) {
      this.logger.warn(message);
    } else {
      console.warn(message);
    }
  }

  /**
   * Get the cache key for a topic's event log.
   *
   * The braces are a cluster hash tag: Redis and Valkey place
   * `pubsub:{topic}` and `pubsub:{topic}:counter` in the same slot, so the one
   * atomic append script can touch both keys without a CROSSSLOT error.
   */
  private getCacheKey(topic: string): string {
    return `${this.keyPrefix}{${topic}}`;
  }

  /**
   * Get the cache key for a topic's index counter.
   */
  private getCounterKey(topic: string): string {
    return `${this.getCacheKey(topic)}:counter`;
  }

  async publish(
    topic: string,
    event: Omit<Event, 'id' | 'createdAt' | 'index'>,
    options?: { localOnly?: boolean },
  ): Promise<void> {
    const fullEvent: Event = {
      ...event,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };

    if (options?.localOnly || this.shouldCache?.(topic) === false) {
      await this.inner.publish(topic, fullEvent, options);
      return;
    }

    // Cache BEFORE live publish so late-joining observers never miss events,
    // and allocate the index as part of that append so list position and index
    // cannot disagree.
    let index: number | undefined;
    if (this.cache.supportsAtomicAppend) {
      try {
        index = await this.cache.listPushIndexed(this.getCacheKey(topic), this.getCounterKey(topic), fullEvent);
      } catch (error) {
        this.logError(`[CachingPubSub] Failed to cache event for ${topic}`, error);
      }
    }

    // On cache failure leave `index` undefined rather than defaulting to 0:
    // downstream consumers that key off `index` (e.g. replay-from-offset)
    // would otherwise see colliding indices across failed publishes.
    const numbered: Event = index !== undefined ? { ...fullEvent, index } : fullEvent;

    // Always publish to inner PubSub — cache failure must not block live delivery.
    await this.inner.publish(topic, numbered, options);
  }

  /**
   * Subscribe to live events on a topic (no replay).
   */
  async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    await this.inner.subscribe(topic, cb, options);
  }

  /**
   * Subscribe to a topic with automatic replay of cached events.
   * Delegates to {@link subscribeFromOffset} with offset 0.
   */
  async subscribeWithReplay(topic: string, cb: EventCallback): Promise<void> {
    return this.subscribeFromOffset(topic, 0, cb);
  }

  /**
   * Subscribe to a topic with replay starting at a specific index.
   *
   * The subscriber keeps one cursor, `next`, and every frame it receives is
   * reconciled against it:
   * - `index < next` — already delivered (transport replay, retry, or a
   *   duplicate) → dropped.
   * - `index === next` — the next frame in the log → delivered.
   * - `index > next` — frames arrived out of order. Because a frame is appended
   *   to the log before it is published, the missing frames are already in the
   *   log, so they are read back in order and delivered before this one. That
   *   holds even when the transport replays nothing at all.
   *
   * One exception to the first rule: a frame numbered `0` whose counter shows
   * the log restarted. That means the retained log expired or was cleared and
   * a new run segment began numbering at 0; the cursor resyncs and the frame is
   * delivered, instead of silently dropping the whole new segment. Nack
   * redeliveries (`deliveryAttempt > 1`) also bypass reconciliation, since a
   * retry of an already-cursor-advanced frame still has to reach the consumer.
   *
   * When the log no longer holds the missing range (no shared cache, or the
   * TTL lapsed) there is nothing to replay; the cursor resynchronises to the
   * frame in hand so live delivery continues.
   *
   * @param topic - The topic to subscribe to
   * @param offset - Start replaying from this index (0-based)
   * @param cb - Callback invoked for each event
   */
  async subscribeFromOffset(topic: string, offset: number, cb: EventCallback): Promise<void> {
    const cacheKey = this.getCacheKey(topic);

    let next = offset;
    let closed = false;
    // Set only while a backfill (or the initial history read) is in flight.
    // Frames delivered meanwhile must wait, or the cursor could advance past a
    // frame that has not been handed to the consumer yet. In the common case
    // (a frame that is next) delivery stays synchronous.
    let pending: Promise<void> | null = null;
    let deferred = false;

    const emit = (event: Event, ack?: () => Promise<void>, nack?: () => Promise<void>) => {
      if (typeof event.index === 'number') next = event.index + 1;
      return cb(event, ack, nack);
    };

    /** Deliver everything the log holds between the cursor and `target`. */
    const backfill = async (target: number) => {
      if (target <= next) return;
      const entries = (await this.cache.listFromTo(cacheKey, next)) as Event[];
      for (const entry of entries) {
        if (closed) return;
        const seq = entry.index;
        if (typeof seq !== 'number' || seq < next) continue;
        if (seq >= target) return;
        await emit(entry);
      }
    };

    const reconcile = (event: Event, ack?: () => Promise<void>, nack?: () => Promise<void>): void | Promise<void> => {
      // A nack-redelivery carries the same index but `deliveryAttempt > 1`;
      // the consumer must see it again to retry processing.
      if (event.deliveryAttempt !== undefined && event.deliveryAttempt > 1) {
        return cb(event, ack, nack);
      }

      const seq = event.index;
      if (typeof seq !== 'number') {
        // No numbering (the cache cannot append atomically): live-only delivery.
        return cb(event, ack, nack);
      }

      // Already delivered (a retained transport copy of a frame the log
      // provided). Acknowledge it so it does not stay pending on the backend.
      if (seq < next) {
        if (seq !== 0) return ack?.();

        // Index 0 while the cursor has already advanced means the log this
        // subscriber was reading is gone: it expired (or was cleared) and the
        // run resumed, restarting numbering at 0. Dropping it would swallow
        // every frame of the new segment, since all of their indices sit below
        // the stale cursor. Confirm against the counter — it restarts with the
        // log, so in a continuous log it can never be below our cursor.
        deferred = true;
        return (async () => {
          // A cache read failure must not turn a duplicate into a nack loop;
          // fall through to the drop path in that case.
          const allocated = await this.cache.get(this.getCounterKey(topic)).catch(() => undefined);
          if (closed) return ack?.();

          if (typeof allocated === 'number' && allocated < next) {
            this.logWarn(
              `[CachingPubSub] Log for ${topic} restarted at 0 while the subscriber cursor was at ${next}; ` +
                `the retained log expired or was cleared. Resyncing from the start of the new segment.`,
            );
            next = 0;
            await emit(event, ack, nack);
            return;
          }

          // A late copy of this log's real first frame: nothing to resync.
          await ack?.();
        })();
      }

      if (seq > next) {
        // Frames arrived out of order. The log already holds the missing ones,
        // so this has to wait for them; queue later frames behind it.
        deferred = true;
        return (async () => {
          await backfill(seq);
          if (closed) return;
          if (seq < next) {
            // The log supplied this frame; the transport copy is a duplicate.
            await ack?.();
            return;
          }
          // Nothing left in the log for the gap; resume from this frame.
          next = seq;
          await emit(event, ack, nack);
        })();
      }

      return emit(event, ack, nack);
    };

    const failDelivery = async (error: unknown, nack?: () => Promise<void>) => {
      this.logError(`[CachingPubSub] Subscriber failed for ${topic}`, error);
      await nack?.().catch(() => {});
    };

    const wrappedCb: EventCallback = (event, ack, nack) => {
      if (closed) {
        // Nobody will process this delivery; acknowledge so it is not stranded.
        return ack?.();
      }

      if (pending) {
        const run = pending.then(() => reconcile(event, ack, nack));
        pending = run.catch(error => failDelivery(error, nack));
        return pending;
      }

      deferred = false;
      const result = reconcile(event, ack, nack);
      if (!deferred) return result;

      // A gap triggered a backfill: hold later frames until it completes.
      pending = (result as Promise<void>)
        .catch(error => failDelivery(error, nack))
        .then(() => {
          pending = null;
        });
      return pending;
    };

    this.callbackMap.set(cb, wrappedCb);
    try {
      // Subscribe before reading history so no frame is missed. Live frames
      // arriving during the read queue behind it.
      await this.inner.subscribe(topic, wrappedCb);

      let releaseHistory!: () => void;
      const historyGate = new Promise<void>(resolve => {
        releaseHistory = resolve;
      });
      pending = historyGate;
      try {
        const entries = (await this.cache.listFromTo(cacheKey, next)) as Event[];
        for (const entry of entries) {
          if (closed) return;
          const seq = entry.index;
          if (typeof seq !== 'number' || seq < next) continue;
          await emit(entry);
        }
      } finally {
        pending = null;
        releaseHistory();
      }
    } catch (error) {
      // Rollback so the callback isn't stranded on the inner transport.
      closed = true;
      this.callbackMap.delete(cb);
      await this.inner.unsubscribe(topic, wrappedCb).catch(() => {});
      throw error;
    }
  }

  /**
   * Unsubscribe from a topic.
   */
  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    const wrappedCb = this.callbackMap.get(cb) ?? cb;
    this.callbackMap.delete(cb);
    await this.inner.unsubscribe(topic, wrappedCb);
  }

  /**
   * Get historical events for a topic from cache.
   *
   * The list is the log: entry position and `index` are allocated together, so
   * a slice from `offset` is the events from that index on.
   */
  async getHistory(topic: string, offset: number = 0): Promise<Event[]> {
    const events = (await this.cache.listFromTo(this.getCacheKey(topic), offset)) as Event[];
    return events.filter(event => typeof event.index !== 'number' || event.index >= offset);
  }

  /**
   * Flush any pending operations on the inner PubSub.
   */
  async flush(): Promise<void> {
    await this.inner.flush();
  }

  /**
   * Expose the inner's {@link LeaseProvider} when it has one, otherwise
   * `undefined`. Leasing is a capability of the underlying backend
   * (e.g. Redis), not of the caching decorator itself — so rather than
   * unconditionally declaring lease methods (which would make
   * {@link isLeaseProvider} report `true` even when the inner can't
   * coordinate a lock), we surface the inner's capability directly. The
   * signals runtime unwraps this so wrapping with caching preserves real
   * distributed lease semantics without faking them.
   */
  getLeaseProvider(): LeaseProvider | undefined {
    return isLeaseProvider(this.inner) ? this.inner : undefined;
  }

  /**
   * Clear cached events for a specific topic (and the index counter), and
   * forward the clear to the inner transport.
   *
   * Call this when a stream completes to free memory. The forward matters for
   * persistent inner transports (e.g. Redis Streams): without it, wrapping a
   * pubsub in `CachingPubSub` silently turns `clearTopic` into a cache-only
   * no-op and the inner stream leaks forever.
   */
  override async clearTopic(topic: string): Promise<void> {
    try {
      await Promise.all([
        this.cache.delete(this.getCacheKey(topic)),
        this.cache.delete(this.getCounterKey(topic)),
        this.inner.clearTopic(topic),
      ]);
    } catch (error) {
      // Honor the base-class contract: clearTopic is best-effort and callers
      // invoke it fire-and-forget, so a cache failure must not become an
      // unhandled rejection. A failed delete means retained state may leak
      // until the transport-level TTL backstop, so make it visible.
      this.logError(`[CachingPubSub] Failed to clear topic ${topic}`, error);
    }
  }

  /** Forward run trims to the inner transport; the per-process cache is left to its own bounds. */
  override async trimTopic(topic: string, options: { runId: string; producedBefore?: number }): Promise<void> {
    try {
      await this.inner.trimTopic(topic, options);
    } catch (error) {
      this.logError(`[CachingPubSub] Failed to trim topic ${topic}`, error);
    }
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
