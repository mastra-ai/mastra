import type { MastraServerCache } from '../cache/base';
import { PubSub } from './pubsub';
import type { EventCallback } from './pubsub';
import type { Event } from './types';

/**
 * Options for CachingPubSub
 */
export interface CachingPubSubOptions {
  /**
   * Optional prefix for cache keys to namespace events.
   * Defaults to 'pubsub:'.
   */
  keyPrefix?: string;
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

  constructor(
    private readonly inner: PubSub,
    private readonly cache: MastraServerCache,
    options: CachingPubSubOptions = {},
  ) {
    super();
    this.keyPrefix = options.keyPrefix ?? 'pubsub:';
  }

  /**
   * Get the cache key for a topic
   */
  private getCacheKey(topic: string): string {
    return `${this.keyPrefix}${topic}`;
  }

  /**
   * Publish an event to a topic.
   * The event is cached before being published to the inner PubSub.
   */
  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    const fullEvent: Event = {
      ...event,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };

    // Cache the event (non-blocking, errors are logged but don't fail publish)
    const cacheKey = this.getCacheKey(topic);
    this.cache.listPush(cacheKey, fullEvent).catch(err => {
      console.error(`[CachingPubSub] Failed to cache event for topic ${topic}:`, err);
    });

    // Publish to inner PubSub
    await this.inner.publish(topic, event);
  }

  /**
   * Subscribe to live events on a topic (no replay).
   */
  async subscribe(topic: string, cb: EventCallback): Promise<void> {
    await this.inner.subscribe(topic, cb);
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
    const seen = new Set<string>();

    // Wrap callback to deduplicate events
    const wrappedCb: EventCallback = (event, ack) => {
      if (!seen.has(event.id)) {
        seen.add(event.id);
        cb(event, ack);
      }
    };

    // 1. Subscribe to live events FIRST to avoid race condition
    await this.inner.subscribe(topic, wrappedCb);

    // 2. Fetch and replay cached history
    const history = await this.getHistory(topic);
    for (const event of history) {
      if (!seen.has(event.id)) {
        seen.add(event.id);
        cb(event);
      }
    }
  }

  /**
   * Unsubscribe from a topic.
   */
  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    await this.inner.unsubscribe(topic, cb);
  }

  /**
   * Get historical events for a topic from cache.
   */
  async getHistory(topic: string, fromIndex: number = 0): Promise<Event[]> {
    const cacheKey = this.getCacheKey(topic);
    const events = await this.cache.listFromTo(cacheKey, fromIndex);
    return events as Event[];
  }

  /**
   * Flush any pending operations.
   */
  async flush(): Promise<void> {
    await this.inner.flush();
  }

  /**
   * Clear cached events for a specific topic.
   * Call this when a stream completes to free memory.
   */
  async clearTopic(topic: string): Promise<void> {
    const cacheKey = this.getCacheKey(topic);
    await this.cache.delete(cacheKey);
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
