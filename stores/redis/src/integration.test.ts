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
 * pnpm test:integration
 * ```
 */

import { CachingPubSub, EventEmitterPubSub } from '@mastra/core/events';
import type { Event } from '@mastra/core/events';
import Redis from 'ioredis';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { RedisServerCache } from './index';

// Redis connection for integration tests
// Uses port 6399 to avoid conflict with default Redis port
const REDIS_PORT = 6399;
const REDIS_URL = `redis://localhost:${REDIS_PORT}`;

describe('RedisServerCache Integration', () => {
  let redis: Redis;
  let cache: RedisServerCache;

  beforeAll(async () => {
    redis = new Redis(REDIS_URL, {
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
  });
});

describe('CachingPubSub with Redis Integration', () => {
  let redis: Redis;
  let cache: RedisServerCache;
  let innerPubsub: EventEmitterPubSub;
  let cachingPubsub: CachingPubSub;

  beforeAll(async () => {
    redis = new Redis(REDIS_URL, {
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
