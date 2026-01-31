import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryServerCache } from '../cache/inmemory';
import { CachingPubSub, withCaching } from './caching-pubsub';
import { EventEmitterPubSub } from './event-emitter';
import type { Event } from './types';

describe('CachingPubSub', () => {
  let cache: InMemoryServerCache;
  let innerPubsub: EventEmitterPubSub;
  let cachingPubsub: CachingPubSub;

  beforeEach(() => {
    cache = new InMemoryServerCache();
    innerPubsub = new EventEmitterPubSub();
    cachingPubsub = new CachingPubSub(innerPubsub, cache);
  });

  describe('publish', () => {
    it('should cache events when publishing', async () => {
      const topic = 'test-topic';
      const event = { type: 'test', runId: 'run-1', data: { foo: 'bar' } };

      await cachingPubsub.publish(topic, event);

      // Wait a tick for async cache write
      await new Promise(resolve => setTimeout(resolve, 10));

      const history = await cachingPubsub.getHistory(topic);
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        type: 'test',
        runId: 'run-1',
        data: { foo: 'bar' },
      });
      expect(history[0].id).toBeDefined();
      expect(history[0].createdAt).toBeInstanceOf(Date);
    });

    it('should publish to inner pubsub', async () => {
      const topic = 'test-topic';
      const event = { type: 'test', runId: 'run-1', data: {} };
      const callback = vi.fn();

      await innerPubsub.subscribe(topic, callback);
      await cachingPubsub.publish(topic, event);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'test',
          runId: 'run-1',
        }),
      );
    });

    it('should cache multiple events in order', async () => {
      const topic = 'test-topic';

      await cachingPubsub.publish(topic, { type: 'first', runId: 'run-1', data: {} });
      await cachingPubsub.publish(topic, { type: 'second', runId: 'run-1', data: {} });
      await cachingPubsub.publish(topic, { type: 'third', runId: 'run-1', data: {} });

      // Wait for async cache writes
      await new Promise(resolve => setTimeout(resolve, 10));

      const history = await cachingPubsub.getHistory(topic);
      expect(history).toHaveLength(3);
      expect(history[0].type).toBe('first');
      expect(history[1].type).toBe('second');
      expect(history[2].type).toBe('third');
    });

    it('should assign sequential indices to events', async () => {
      const topic = 'index-topic';

      await cachingPubsub.publish(topic, { type: 'first', runId: 'run-1', data: {} });
      await cachingPubsub.publish(topic, { type: 'second', runId: 'run-1', data: {} });
      await cachingPubsub.publish(topic, { type: 'third', runId: 'run-1', data: {} });

      // Wait for async cache writes
      await new Promise(resolve => setTimeout(resolve, 10));

      const history = await cachingPubsub.getHistory(topic);
      expect(history).toHaveLength(3);
      expect(history[0].index).toBe(0);
      expect(history[1].index).toBe(1);
      expect(history[2].index).toBe(2);
    });

    it('should include index in live events', async () => {
      const topic = 'live-index-topic';
      const receivedEvents: Event[] = [];

      await cachingPubsub.subscribe(topic, event => {
        receivedEvents.push(event);
      });

      await cachingPubsub.publish(topic, { type: 'first', runId: 'run-1', data: {} });
      await cachingPubsub.publish(topic, { type: 'second', runId: 'run-1', data: {} });

      expect(receivedEvents).toHaveLength(2);
      expect(receivedEvents[0].index).toBe(0);
      expect(receivedEvents[1].index).toBe(1);
    });

    it('should recover index from cache after restart', async () => {
      const topic = 'recovery-topic';

      // Simulate first session - publish some events
      await cachingPubsub.publish(topic, { type: 'first', runId: 'run-1', data: {} });
      await cachingPubsub.publish(topic, { type: 'second', runId: 'run-1', data: {} });
      await new Promise(resolve => setTimeout(resolve, 10));

      // Simulate restart - create new CachingPubSub with same cache
      const newPubsub = new CachingPubSub(new EventEmitterPubSub(), cache);

      // Publish more events - should continue from index 2
      await newPubsub.publish(topic, { type: 'third', runId: 'run-1', data: {} });
      await new Promise(resolve => setTimeout(resolve, 10));

      const history = await newPubsub.getHistory(topic);
      expect(history).toHaveLength(3);
      expect(history[0].index).toBe(0);
      expect(history[1].index).toBe(1);
      expect(history[2].index).toBe(2);
    });

    it('should reset index when topic is cleared', async () => {
      const topic = 'clear-topic';

      await cachingPubsub.publish(topic, { type: 'first', runId: 'run-1', data: {} });
      await cachingPubsub.publish(topic, { type: 'second', runId: 'run-1', data: {} });
      await new Promise(resolve => setTimeout(resolve, 10));

      await cachingPubsub.clearTopic(topic);

      // Publish after clear - should start from index 0
      await cachingPubsub.publish(topic, { type: 'new-first', runId: 'run-2', data: {} });
      await new Promise(resolve => setTimeout(resolve, 10));

      const history = await cachingPubsub.getHistory(topic);
      expect(history).toHaveLength(1);
      expect(history[0].index).toBe(0);
      expect(history[0].type).toBe('new-first');
    });
  });

  describe('subscribe', () => {
    it('should subscribe to live events without replay', async () => {
      const topic = 'test-topic';
      const callback = vi.fn();

      // Publish some events first
      await cachingPubsub.publish(topic, { type: 'cached', runId: 'run-1', data: {} });
      await new Promise(resolve => setTimeout(resolve, 10));

      // Subscribe with regular subscribe (no replay)
      await cachingPubsub.subscribe(topic, callback);

      // Publish a new event
      await cachingPubsub.publish(topic, { type: 'live', runId: 'run-1', data: {} });

      // Should only receive the live event, not the cached one
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ type: 'live' }));
    });
  });

  describe('subscribeWithReplay', () => {
    it('should replay cached events then receive live events', async () => {
      const topic = 'test-topic';
      const receivedEvents: Event[] = [];
      const callback = vi.fn((event: Event) => {
        receivedEvents.push(event);
      });

      // Publish some events first
      await cachingPubsub.publish(topic, { type: 'cached-1', runId: 'run-1', data: {} });
      await cachingPubsub.publish(topic, { type: 'cached-2', runId: 'run-1', data: {} });
      await new Promise(resolve => setTimeout(resolve, 10));

      // Subscribe with replay
      await cachingPubsub.subscribeWithReplay(topic, callback);

      // Should have received cached events
      expect(receivedEvents).toHaveLength(2);
      expect(receivedEvents[0].type).toBe('cached-1');
      expect(receivedEvents[1].type).toBe('cached-2');

      // Publish a live event
      await cachingPubsub.publish(topic, { type: 'live', runId: 'run-1', data: {} });

      // Should also receive the live event
      expect(receivedEvents).toHaveLength(3);
      expect(receivedEvents[2].type).toBe('live');
    });

    it('should deduplicate events at the replay/live boundary', async () => {
      const topic = 'test-topic';
      const receivedEvents: Event[] = [];
      const callback = vi.fn((event: Event) => {
        receivedEvents.push(event);
      });

      // Create a custom pubsub that simulates a race condition
      // where the same event arrives both via cache replay and live subscription
      const racyInnerPubsub = new EventEmitterPubSub();
      const racyCachingPubsub = new CachingPubSub(racyInnerPubsub, cache);

      // Publish an event
      await racyCachingPubsub.publish(topic, { type: 'boundary-event', runId: 'run-1', data: {} });
      await new Promise(resolve => setTimeout(resolve, 10));

      // Subscribe with replay
      await racyCachingPubsub.subscribeWithReplay(topic, callback);

      // Should only receive the event once (deduped by ID)
      const boundaryEvents = receivedEvents.filter(e => e.type === 'boundary-event');
      expect(boundaryEvents).toHaveLength(1);
    });

    it('should handle empty cache gracefully', async () => {
      const topic = 'empty-topic';
      const callback = vi.fn();

      await cachingPubsub.subscribeWithReplay(topic, callback);

      // No cached events, so callback shouldn't be called yet
      expect(callback).not.toHaveBeenCalled();

      // Publish a live event
      await cachingPubsub.publish(topic, { type: 'first-event', runId: 'run-1', data: {} });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('getHistory', () => {
    it('should return cached events for a topic', async () => {
      const topic = 'history-topic';

      await cachingPubsub.publish(topic, { type: 'event-1', runId: 'run-1', data: { a: 1 } });
      await cachingPubsub.publish(topic, { type: 'event-2', runId: 'run-1', data: { b: 2 } });
      await new Promise(resolve => setTimeout(resolve, 10));

      const history = await cachingPubsub.getHistory(topic);

      expect(history).toHaveLength(2);
      expect(history[0].data).toEqual({ a: 1 });
      expect(history[1].data).toEqual({ b: 2 });
    });

    it('should return events from specified index', async () => {
      const topic = 'history-topic';

      await cachingPubsub.publish(topic, { type: 'event-0', runId: 'run-1', data: {} });
      await cachingPubsub.publish(topic, { type: 'event-1', runId: 'run-1', data: {} });
      await cachingPubsub.publish(topic, { type: 'event-2', runId: 'run-1', data: {} });
      await new Promise(resolve => setTimeout(resolve, 10));

      const history = await cachingPubsub.getHistory(topic, 1);

      expect(history).toHaveLength(2);
      expect(history[0].type).toBe('event-1');
      expect(history[1].type).toBe('event-2');
    });

    it('should return empty array for non-existent topic', async () => {
      const history = await cachingPubsub.getHistory('non-existent-topic');
      expect(history).toEqual([]);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe from topic', async () => {
      const topic = 'unsub-topic';
      const callback = vi.fn();

      await cachingPubsub.subscribe(topic, callback);
      await cachingPubsub.publish(topic, { type: 'before-unsub', runId: 'run-1', data: {} });

      expect(callback).toHaveBeenCalledTimes(1);

      await cachingPubsub.unsubscribe(topic, callback);
      await cachingPubsub.publish(topic, { type: 'after-unsub', runId: 'run-1', data: {} });

      // Should still only have been called once (before unsubscribe)
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearTopic', () => {
    it('should clear cached events for a topic', async () => {
      const topic = 'clear-topic';

      await cachingPubsub.publish(topic, { type: 'event-1', runId: 'run-1', data: {} });
      await cachingPubsub.publish(topic, { type: 'event-2', runId: 'run-1', data: {} });
      await new Promise(resolve => setTimeout(resolve, 10));

      let history = await cachingPubsub.getHistory(topic);
      expect(history).toHaveLength(2);

      await cachingPubsub.clearTopic(topic);

      history = await cachingPubsub.getHistory(topic);
      expect(history).toHaveLength(0);
    });

    it('should not affect other topics', async () => {
      const topic1 = 'topic-1';
      const topic2 = 'topic-2';

      await cachingPubsub.publish(topic1, { type: 'event-1', runId: 'run-1', data: {} });
      await cachingPubsub.publish(topic2, { type: 'event-2', runId: 'run-1', data: {} });
      await new Promise(resolve => setTimeout(resolve, 10));

      await cachingPubsub.clearTopic(topic1);

      const history1 = await cachingPubsub.getHistory(topic1);
      const history2 = await cachingPubsub.getHistory(topic2);

      expect(history1).toHaveLength(0);
      expect(history2).toHaveLength(1);
    });
  });

  describe('flush', () => {
    it('should delegate flush to inner pubsub', async () => {
      const flushSpy = vi.spyOn(innerPubsub, 'flush');

      await cachingPubsub.flush();

      expect(flushSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getInner', () => {
    it('should return the inner pubsub instance', () => {
      expect(cachingPubsub.getInner()).toBe(innerPubsub);
    });
  });

  describe('withCaching factory', () => {
    it('should create a CachingPubSub instance', () => {
      const result = withCaching(innerPubsub, cache);
      expect(result).toBeInstanceOf(CachingPubSub);
    });

    it('should work with custom options', async () => {
      const customPubsub = withCaching(innerPubsub, cache, { keyPrefix: 'custom:' });

      await customPubsub.publish('test', { type: 'test', runId: 'run-1', data: {} });
      await new Promise(resolve => setTimeout(resolve, 10));

      // Events should be cached under custom prefix
      const rawCacheValue = await cache.get('custom:test');
      expect(Array.isArray(rawCacheValue)).toBe(true);
    });
  });

  describe('key prefix', () => {
    it('should use custom key prefix for cache', async () => {
      const prefixedPubsub = new CachingPubSub(innerPubsub, cache, { keyPrefix: 'myapp:' });
      const topic = 'events';

      await prefixedPubsub.publish(topic, { type: 'test', runId: 'run-1', data: {} });
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check cache directly
      const rawCacheValue = await cache.get('myapp:events');
      expect(Array.isArray(rawCacheValue)).toBe(true);
      expect(rawCacheValue).toHaveLength(1);
    });

    it('should use default prefix when not specified', async () => {
      const topic = 'events';

      await cachingPubsub.publish(topic, { type: 'test', runId: 'run-1', data: {} });
      await new Promise(resolve => setTimeout(resolve, 10));

      // Check cache directly with default prefix
      const rawCacheValue = await cache.get('pubsub:events');
      expect(Array.isArray(rawCacheValue)).toBe(true);
    });
  });

  describe('topic isolation', () => {
    it('should keep events separate per topic', async () => {
      const topic1 = 'agent.stream.run-1';
      const topic2 = 'agent.stream.run-2';

      await cachingPubsub.publish(topic1, { type: 'run1-event', runId: 'run-1', data: {} });
      await cachingPubsub.publish(topic2, { type: 'run2-event', runId: 'run-2', data: {} });
      await cachingPubsub.publish(topic1, { type: 'run1-event-2', runId: 'run-1', data: {} });
      await new Promise(resolve => setTimeout(resolve, 10));

      const history1 = await cachingPubsub.getHistory(topic1);
      const history2 = await cachingPubsub.getHistory(topic2);

      expect(history1).toHaveLength(2);
      expect(history1[0].type).toBe('run1-event');
      expect(history1[1].type).toBe('run1-event-2');

      expect(history2).toHaveLength(1);
      expect(history2[0].type).toBe('run2-event');
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent publishes', async () => {
      const topic = 'concurrent-topic';
      const promises: Promise<void>[] = [];

      for (let i = 0; i < 10; i++) {
        promises.push(cachingPubsub.publish(topic, { type: `event-${i}`, runId: 'run-1', data: { index: i } }));
      }

      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 50));

      const history = await cachingPubsub.getHistory(topic);
      expect(history).toHaveLength(10);
    });

    it('should handle concurrent subscribe with replay', async () => {
      const topic = 'concurrent-sub-topic';

      // Publish some events
      for (let i = 0; i < 5; i++) {
        await cachingPubsub.publish(topic, { type: `event-${i}`, runId: 'run-1', data: {} });
      }
      await new Promise(resolve => setTimeout(resolve, 10));

      // Multiple concurrent subscriptions with replay
      const callbacks = [vi.fn(), vi.fn(), vi.fn()];
      await Promise.all(callbacks.map(cb => cachingPubsub.subscribeWithReplay(topic, cb)));

      // Each callback should receive all cached events
      for (const callback of callbacks) {
        expect(callback).toHaveBeenCalledTimes(5);
      }
    });
  });
});
