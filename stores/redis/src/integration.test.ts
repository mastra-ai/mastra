/**
 * Integration tests for RedisServerCache with real Redis.
 *
 * These tests require Docker to be running with Redis:
 * ```bash
 * cd stores/redis && docker-compose up -d
 * ```
 *
 * Run tests:
 * ```bash
 * pnpm test
 * ```
 */

import { CachingPubSub, EventEmitterPubSub } from '@mastra/core/events';
import type { Event } from '@mastra/core/events';
import Redis from 'ioredis';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { RedisServerCache } from './index';

// Redis connection for integration tests
// Must match docker-compose.yaml (port 6380, password redis_password)
const REDIS_PORT = 6380;
const REDIS_URL = `redis://:redis_password@localhost:${REDIS_PORT}`;

describe('RedisServerCache Integration', () => {
  let redis: Redis;
  let cache: RedisServerCache;

  beforeAll(async () => {
    redis = new Redis(REDIS_URL, {
      // ioredis 6 defaults to RESP3; keep RESP2 for the v5-compatible test client.
      protocol: 2,
      maxRetriesPerRequest: 3,
      retryStrategy: times => {
        if (times > 3) {
          throw new Error(`Redis connection failed after ${times} attempts. Is Docker running?`);
        }
        return Math.min(times * 100, 1000);
      },
    });

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      redis.once('ready', resolve);
      redis.once('error', reject);
      setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
    });
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    cache = new RedisServerCache(
      { client: redis },
      {
        keyPrefix: 'test:',
        ttlSeconds: 60, // 1 minute for tests
      },
    );
    // Clear test keys
    await cache.clear();
  });

  afterEach(async () => {
    await cache.clear();
  });

  describe('basic operations', () => {
    it('should set and get values', async () => {
      await cache.set('key1', { foo: 'bar' });
      const result = await cache.get('key1');
      // Cache handles JSON serialization/deserialization automatically
      expect(result).toEqual({ foo: 'bar' });
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should delete keys', async () => {
      await cache.set('key1', 'value');
      await cache.delete('key1');
      const result = await cache.get('key1');
      expect(result).toBeNull();
    });
  });

  describe('list operations', () => {
    it('should push and retrieve list items', async () => {
      // Cache handles JSON serialization automatically
      await cache.listPush('mylist', { id: '1' });
      await cache.listPush('mylist', { id: '2' });
      await cache.listPush('mylist', { id: '3' });

      const items = await cache.listFromTo('mylist', 0);
      expect(items).toHaveLength(3);
      expect(items[0]).toEqual({ id: '1' });
      expect(items[2]).toEqual({ id: '3' });
    });

    it('should return list length', async () => {
      await cache.listPush('mylist', 'item1');
      await cache.listPush('mylist', 'item2');

      const length = await cache.listLength('mylist');
      expect(length).toBe(2);
    });

    it('should return range of items', async () => {
      await cache.listPush('mylist', 'a');
      await cache.listPush('mylist', 'b');
      await cache.listPush('mylist', 'c');
      await cache.listPush('mylist', 'd');

      const range = await cache.listFromTo('mylist', 1, 2);
      expect(range).toEqual(['b', 'c']);
    });
  });

  describe('TTL behavior', () => {
    it('should expire items after TTL', async () => {
      const shortTtlCache = new RedisServerCache(
        { client: redis },
        {
          keyPrefix: 'ttl-test:',
          ttlSeconds: 1, // 1 second TTL
        },
      );

      await shortTtlCache.set('expiring-key', 'value');

      // Value should exist immediately
      const before = await shortTtlCache.get('expiring-key');
      expect(before).toBe('value');

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Value should be gone
      const after = await shortTtlCache.get('expiring-key');
      expect(after).toBeNull();
    });

    it('listPushIndexed seeds a fresh log from the server clock, then numbers atomically and stamps TTL on both keys', async () => {
      // Epoch-seeded on counter miss so a log recreated after expiry or
      // eviction does not reissue an index a subscriber already consumed
      // Seeded in epoch microseconds from the server clock;
      // generous bound for client/server clock skew.
      const before = (Date.now() - 60_000) * 1000;
      const first = await cache.listPushIndexed('events', 'events:counter', {});
      expect(first).toBeGreaterThanOrEqual(before);
      expect(await cache.listPushIndexed('events', 'events:counter', { type: 'a', data: { n: 1 } })).toBe(first + 1);
      expect(
        await cache.listPushIndexed('events', 'events:counter', { type: 'b', big: 9007199254740991, arr: [1, null] }),
      ).toBe(first + 2);

      expect(await cache.listFromTo('events', 0)).toEqual([
        { index: first },
        { index: first + 1, type: 'a', data: { n: 1 } },
        { index: first + 2, type: 'b', big: 9007199254740991, arr: [1, null] },
      ]);
      expect(await cache.increment('events:counter')).toBe(first + 4);

      for (const key of ['test:events', 'test:events:counter']) {
        const ttl = await redis.ttl(key);
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(60);
      }
    });

    it('listPushIndexed numbers above a consumed index after the log and counter were deleted', async () => {
      const first = await cache.listPushIndexed('events', 'events:counter', { type: 'a' });
      const last = await cache.listPushIndexed('events', 'events:counter', { type: 'b' });
      expect(last).toBe(first + 1);

      // volatile-lru eviction or TTL expiry removes both keys.
      await redis.del('test:events', 'test:events:counter');

      // The recreated log reseeds above everything it issued before, so an
      // observer holding a cursor into the old log does not drop the new
      // frames as duplicates.
      expect(await cache.listPushIndexed('events', 'events:counter', { type: 'c' })).toBeGreaterThan(last);
    });

    it('listPushIndexed keeps both keys for a requested TTL longer than the default', async () => {
      const day = 24 * 60 * 60;
      await cache.listPushIndexed('events', 'events:counter', { type: 'a' }, day * 1000);

      for (const key of ['test:events', 'test:events:counter']) {
        const ttl = await redis.ttl(key);
        expect(ttl).toBeGreaterThan(day - 120);
        expect(ttl).toBeLessThanOrEqual(day);
      }
    });

    it('listPushIndexed applies a requested TTL even when the default expiry is disabled', async () => {
      const noExpiry = new RedisServerCache({ client: redis }, { keyPrefix: 'test:', ttlSeconds: 0 });
      await noExpiry.listPushIndexed('events', 'events:counter', { type: 'a' }, 60_000);

      // Thread-stream keys used to accumulate with no TTL at all because a
      // no-expiry default silently discarded the caller's retention bound.
      for (const key of ['test:events', 'test:events:counter']) {
        const ttl = await redis.ttl(key);
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(60);
      }
    });

    it('should apply TTL to keys written via increment', async () => {
      await cache.increment('counter');

      // Bare INCR would leave the key with no expiry (-1); increment must
      // stamp the configured TTL like every other write in this class.
      const ttl = await redis.ttl('test:counter');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });
  });
});

describe('CachingPubSub with Redis Integration', () => {
  let redis: Redis;
  let cache: RedisServerCache;
  let innerPubsub: EventEmitterPubSub;
  let cachingPubsub: CachingPubSub;

  beforeAll(async () => {
    redis = new Redis(REDIS_URL, {
      protocol: 2,
      maxRetriesPerRequest: 3,
      retryStrategy: times => {
        if (times > 3) {
          throw new Error(`Redis connection failed after ${times} attempts`);
        }
        return Math.min(times * 100, 1000);
      },
    });

    await new Promise<void>((resolve, reject) => {
      redis.once('ready', resolve);
      redis.once('error', reject);
      setTimeout(() => reject(new Error('Redis connection timeout')), 5000);
    });
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    cache = new RedisServerCache(
      { client: redis },
      {
        keyPrefix: 'pubsub-test:',
        ttlSeconds: 60,
      },
    );
    innerPubsub = new EventEmitterPubSub();
    cachingPubsub = new CachingPubSub(innerPubsub, cache);
    await cache.clear();
  });

  afterEach(async () => {
    await cache.clear();
  });

  describe('resumable streams with Redis backend', () => {
    it('should replay events to late subscriber', async () => {
      const topic = 'test-stream-1';
      const receivedEvents: Event[] = [];

      // Publish events before any subscriber
      await cachingPubsub.publish(topic, {
        type: 'chunk',
        runId: 'run-1',
        data: { text: 'Hello ' },
      });
      await cachingPubsub.publish(topic, {
        type: 'chunk',
        runId: 'run-1',
        data: { text: 'World!' },
      });

      // Wait for Redis writes
      await new Promise(resolve => setTimeout(resolve, 50));

      // Late subscriber should receive all events
      await cachingPubsub.subscribeWithReplay(topic, event => {
        receivedEvents.push(event);
      });

      expect(receivedEvents).toHaveLength(2);
      expect(receivedEvents[0].data).toEqual({ text: 'Hello ' });
      expect(receivedEvents[1].data).toEqual({ text: 'World!' });
    });

    it('should receive both cached and live events', async () => {
      const topic = 'test-stream-2';
      const receivedEvents: Event[] = [];

      // Publish cached event
      await cachingPubsub.publish(topic, {
        type: 'chunk',
        runId: 'run-2',
        data: { text: 'Cached' },
      });
      await new Promise(resolve => setTimeout(resolve, 50));

      // Subscribe with replay
      await cachingPubsub.subscribeWithReplay(topic, event => {
        receivedEvents.push(event);
      });

      // Publish live event
      await cachingPubsub.publish(topic, {
        type: 'chunk',
        runId: 'run-2',
        data: { text: 'Live' },
      });

      expect(receivedEvents).toHaveLength(2);
      expect(receivedEvents[0].data).toEqual({ text: 'Cached' });
      expect(receivedEvents[1].data).toEqual({ text: 'Live' });
    });

    it('should handle disconnect/reconnect scenario', async () => {
      const topic = 'test-stream-3';
      const firstConnectionEvents: Event[] = [];
      const reconnectionEvents: Event[] = [];

      // First connection
      const firstCallback = (event: Event) => {
        firstConnectionEvents.push(event);
      };
      await cachingPubsub.subscribeWithReplay(topic, firstCallback);

      // Receive some events
      await cachingPubsub.publish(topic, {
        type: 'chunk',
        runId: 'run-3',
        data: { text: 'Before disconnect' },
      });

      // The first live frame after attach reconciles against the log (the
      // cursor sits below the epoch-seeded index), so delivery is async.
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(firstConnectionEvents).toHaveLength(1);

      // Disconnect
      await cachingPubsub.unsubscribe(topic, firstCallback);

      // Events while disconnected
      await cachingPubsub.publish(topic, {
        type: 'chunk',
        runId: 'run-3',
        data: { text: 'During disconnect' },
      });
      await new Promise(resolve => setTimeout(resolve, 50));

      // Reconnect - should get all events
      await cachingPubsub.subscribeWithReplay(topic, event => {
        reconnectionEvents.push(event);
      });

      expect(reconnectionEvents).toHaveLength(2);
      expect(reconnectionEvents[0].data).toEqual({ text: 'Before disconnect' });
      expect(reconnectionEvents[1].data).toEqual({ text: 'During disconnect' });
    });

    it('should maintain topic isolation', async () => {
      const topic1 = 'stream-a';
      const topic2 = 'stream-b';
      const topic1Events: Event[] = [];
      const topic2Events: Event[] = [];

      await cachingPubsub.publish(topic1, {
        type: 'chunk',
        runId: 'a',
        data: { source: 'topic1' },
      });
      await cachingPubsub.publish(topic2, {
        type: 'chunk',
        runId: 'b',
        data: { source: 'topic2' },
      });
      await new Promise(resolve => setTimeout(resolve, 50));

      await cachingPubsub.subscribeWithReplay(topic1, event => {
        topic1Events.push(event);
      });
      await cachingPubsub.subscribeWithReplay(topic2, event => {
        topic2Events.push(event);
      });

      expect(topic1Events).toHaveLength(1);
      expect(topic1Events[0].data).toEqual({ source: 'topic1' });

      expect(topic2Events).toHaveLength(1);
      expect(topic2Events[0].data).toEqual({ source: 'topic2' });
    });
  });
});
