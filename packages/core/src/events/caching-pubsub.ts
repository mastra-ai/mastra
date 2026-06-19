import type { MastraServerCache } from '../cache/base';
import type { IMastraLogger } from '../logger';
import { PubSub } from './pubsub';
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
  }

  get supportsNativeBatching(): boolean {
    return this.inner.supportsNativeBatching;
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
   * Stable key used to deduplicate an event across the cache-replay and
   * live-delivery paths.
   *
   * We cannot dedup on `event.id`: `CachingPubSub.publish` assigns the id and
   * caches the event with it, but inner PubSub implementations
   * (EventEmitterPubSub, UnixSocketPubSub, …) regenerate `id` inside their own
   * `publish`, so the cached copy and the live copy of the SAME publish carry
   * different ids. The sequential `index` is assigned here and is preserved by
   * every inner implementation, so it matches across both paths. Events without
   * an index are never cached (see `publish`), so they can't be replay/live
   * duplicated — falling back to `id` for them is safe.
   */
  private dedupKey(event: Event): string {
    return event.index !== undefined ? `i:${event.index}` : `id:${event.id}`;
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
  async publish(
    topic: string,
    event: Omit<Event, 'id' | 'createdAt' | 'index'>,
    options?: { localOnly?: boolean },
  ): Promise<void> {
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
    // downstream consumers that key off `index` (e.g. replay-from-offset)
    // would otherwise see colliding indices across failed publishes.
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
    await this.inner.publish(topic, fullEvent, options);
  }

  /**
   * Subscribe to live events on a topic (no replay).
   */
  async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    await this.inner.subscribe(topic, cb, options);
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
        const key = this.dedupKey(event);
        if (!seen.has(key)) {
          seen.add(key);
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
      const key = this.dedupKey(event);
      if (!seen!.has(key)) {
        seen!.add(key);
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
        const key = this.dedupKey(event);
        if (!seen.has(key)) {
          seen.add(key);
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
      const key = this.dedupKey(event);
      if (!seen!.has(key)) {
        seen!.add(key);
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
   * Flush any pending operations on the inner PubSub.
   */
  async flush(): Promise<void> {
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
