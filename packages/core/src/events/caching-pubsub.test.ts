import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryServerCache } from '../cache/inmemory';
import { CachingPubSub, withCaching } from './caching-pubsub';
import { EventEmitterPubSub } from './event-emitter';
import { isLeaseProvider, PubSub } from './pubsub';
import type { Event, EventCallback } from './types';

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
        expect.any(Function),
        expect.any(Function),
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
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'live' }),
        expect.any(Function),
        expect.any(Function),
      );
    });

    it('forwards options (including batch) verbatim to the inner PubSub', async () => {
      const subscribeSpy = vi.fn(async () => {});
      class StubInner extends PubSub {
        get supportsNativeBatching() {
          return true;
        }
        async publish() {}
        subscribe = subscribeSpy;
        async unsubscribe() {}
        async flush() {}
      }
      const wrapped = new CachingPubSub(new StubInner(), cache);
      const cb = () => {};
      const options = { batch: { maxSize: 2, maxWaitMs: 50 } };
      await wrapped.subscribe('t', cb, options);
      expect(subscribeSpy).toHaveBeenCalledWith('t', cb, options);
    });

    it('reports supportsNativeBatching by delegating to the inner PubSub', () => {
      class NativeInner extends PubSub {
        get supportsNativeBatching() {
          return true;
        }
        async publish() {}
        async subscribe() {}
        async unsubscribe() {}
        async flush() {}
      }
      class NonNativeInner extends PubSub {
        async publish() {}
        async subscribe() {}
        async unsubscribe() {}
        async flush() {}
      }
      expect(new CachingPubSub(new NativeInner(), cache).supportsNativeBatching).toBe(true);
      expect(new CachingPubSub(new NonNativeInner(), cache).supportsNativeBatching).toBe(false);
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

      const racyInnerPubsub = new EventEmitterPubSub();
      const racyCachingPubsub = new CachingPubSub(racyInnerPubsub, cache);

      await racyCachingPubsub.publish(topic, { type: 'boundary-event', runId: 'run-1', data: {} });
      await new Promise(resolve => setTimeout(resolve, 10));

      await racyCachingPubsub.subscribeWithReplay(topic, callback);

      const boundaryEvents = receivedEvents.filter(e => e.type === 'boundary-event');
      expect(boundaryEvents).toHaveLength(1);
    });

    it('should not duplicate an event published while the subscription is being established', async () => {
      const topic = 'replay-race-topic';
      const received: string[] = [];

      // Pre-fill history before any subscriber exists.
      await cachingPubsub.publish(topic, { type: 'chunk', runId: 'r1', data: { c: '0' } });
      await cachingPubsub.publish(topic, { type: 'chunk', runId: 'r1', data: { c: '1' } });

      // Force the race: publish "2" exactly between inner.subscribe() and
      // getHistory(), so it lands in both the live stream and the replayed history.
      const realGetHistory = cachingPubsub.getHistory.bind(cachingPubsub);
      let raced = false;
      vi.spyOn(cachingPubsub, 'getHistory').mockImplementation(async (t: string, offset?: number) => {
        if (!raced) {
          raced = true;
          await cachingPubsub.publish(topic, { type: 'chunk', runId: 'r1', data: { c: '2' } });
        }
        return realGetHistory(t, offset);
      });

      await cachingPubsub.subscribeWithReplay(topic, (event: Event) => {
        received.push((event.data as { c: string }).c);
      });

      const counts = received.reduce<Record<string, number>>((acc, c) => {
        acc[c] = (acc[c] ?? 0) + 1;
        return acc;
      }, {});
      expect(counts).toEqual({ '0': 1, '1': 1, '2': 1 });
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

  describe('subscribeFromOffset', () => {
    it('should not duplicate an event published while the subscription is being established', async () => {
      const topic = 'offset-race-topic';
      const received: string[] = [];

      await cachingPubsub.publish(topic, { type: 'chunk', runId: 'r1', data: { c: '0' } });
      await cachingPubsub.publish(topic, { type: 'chunk', runId: 'r1', data: { c: '1' } });

      const realGetHistory = cachingPubsub.getHistory.bind(cachingPubsub);
      let raced = false;
      vi.spyOn(cachingPubsub, 'getHistory').mockImplementation(async (t: string, offset?: number) => {
        if (!raced) {
          raced = true;
          await cachingPubsub.publish(topic, { type: 'chunk', runId: 'r1', data: { c: '2' } });
        }
        return realGetHistory(t, offset);
      });

      await cachingPubsub.subscribeFromOffset(topic, 0, (event: Event) => {
        received.push((event.data as { c: string }).c);
      });

      const counts = received.reduce<Record<string, number>>((acc, c) => {
        acc[c] = (acc[c] ?? 0) + 1;
        return acc;
      }, {});
      expect(counts).toEqual({ '0': 1, '1': 1, '2': 1 });
    });

    it('skips events before the requested offset', async () => {
      const topic = 'offset-skip-topic';

      await cachingPubsub.publish(topic, { type: 'e0', runId: 'r1', data: {} });
      await cachingPubsub.publish(topic, { type: 'e1', runId: 'r1', data: {} });
      await cachingPubsub.publish(topic, { type: 'e2', runId: 'r1', data: {} });
      await cachingPubsub.publish(topic, { type: 'e3', runId: 'r1', data: {} });

      const received: number[] = [];
      await cachingPubsub.subscribeFromOffset(topic, 2, (event: Event) => {
        received.push(event.index!);
      });

      expect(received).toEqual([2, 3]);
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

  describe('lease provider', () => {
    it('exposes the inner pubsub as the lease provider when the inner can lease', () => {
      const leaseProvider = cachingPubsub.getLeaseProvider();
      expect(leaseProvider).toBe(innerPubsub);
      expect(isLeaseProvider(leaseProvider)).toBe(true);
    });

    it('returns undefined when the inner pubsub cannot lease', () => {
      class NonLeaseInner extends PubSub {
        async publish() {}
        async subscribe() {}
        async unsubscribe() {}
        async flush() {}
      }
      const wrapped = new CachingPubSub(new NonLeaseInner(), cache);
      expect(wrapped.getLeaseProvider()).toBeUndefined();
    });

    it('preserves real lease semantics through the inner lease provider', async () => {
      // Caching is transparent to leasing: callers resolve the inner's
      // provider and coordinate through it, so wrapping with caching must
      // not fake or weaken the lock. This guards against a regression where
      // a second owner could "acquire" an already-held lease.
      const leaseProvider = cachingPubsub.getLeaseProvider();
      expect(leaseProvider).toBeDefined();

      const first = await leaseProvider!.acquireLease('thread-1', 'owner-a', 5000);
      expect(first).toEqual({ acquired: true, owner: 'owner-a' });

      const second = await leaseProvider!.acquireLease('thread-1', 'owner-b', 5000);
      expect(second.acquired).toBe(false);
      expect(second.owner).toBe('owner-a');

      expect(await leaseProvider!.getLeaseOwner('thread-1')).toBe('owner-a');

      await leaseProvider!.releaseLease('thread-1', 'owner-a');
      expect(await leaseProvider!.getLeaseOwner('thread-1')).toBeUndefined();
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

  describe('publish resilience', () => {
    it('should still deliver to live subscribers when cache.listPush fails', async () => {
      const topic = 'cache-fail-topic';
      const callback = vi.fn();

      // Create a cache that throws on listPush
      const failingCache = new InMemoryServerCache();
      failingCache.listPush = async (_key: string, _value: unknown) => {
        throw new Error('Cache write failed');
      };

      const failingCachingPubsub = new CachingPubSub(innerPubsub, failingCache);

      await failingCachingPubsub.subscribe(topic, callback);
      await failingCachingPubsub.publish(topic, { type: 'test', runId: 'run-1', data: { hello: 'world' } });

      // Live subscriber should still receive the event even though cache failed
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'test', data: { hello: 'world' } }),
        expect.any(Function),
        expect.any(Function),
      );
    });

    it('should still deliver to live subscribers when cache.increment fails', async () => {
      const topic = 'increment-fail-topic';
      const callback = vi.fn();

      const failingCache = new InMemoryServerCache();
      failingCache.increment = async (_key: string) => {
        throw new Error('Increment failed');
      };
      const listPushSpy = vi.spyOn(failingCache, 'listPush');

      const failingCachingPubsub = new CachingPubSub(innerPubsub, failingCache);

      await failingCachingPubsub.subscribe(topic, callback);
      await failingCachingPubsub.publish(topic, { type: 'test', runId: 'run-1', data: {} });

      // Live subscriber should still receive the event
      expect(callback).toHaveBeenCalledTimes(1);

      // listPush should NOT be called when increment failed (avoids duplicate index-0 entries)
      expect(listPushSpy).not.toHaveBeenCalled();
    });
  });

  describe('steady-state dedup after replay', () => {
    it('uses bounded watermark instead of unbounded seen set after replay', async () => {
      const topic = 'seen-set-topic';

      // Publish a cached event before subscribing
      await cachingPubsub.publish(topic, { type: 'cached', runId: 'run-1', data: {} });
      await new Promise(resolve => setTimeout(resolve, 10));

      const callback = vi.fn();
      await cachingPubsub.subscribeWithReplay(topic, callback);

      expect(callback).toHaveBeenCalledTimes(1);

      // Send 50 live events
      for (let i = 0; i < 50; i++) {
        await cachingPubsub.publish(topic, { type: `live-${i}`, runId: 'run-1', data: {} });
      }
      expect(callback).toHaveBeenCalledTimes(51); // 1 cached + 50 live

      // Get the wrappedCb from the callbackMap
      const callbackMap = (cachingPubsub as any).callbackMap as Map<any, any>;
      const wrappedCb = callbackMap.get(callback);
      expect(wrappedCb).toBeDefined();

      // After replay, the wrapper uses a lastDelivered watermark. A genuinely
      // new event (index higher than anything seen) should still be delivered.
      callback.mockClear();
      const newEvent = {
        id: 'brand-new',
        type: 'test',
        runId: 'run-1',
        data: {},
        createdAt: new Date(),
        index: 999,
      };
      wrappedCb(newEvent);
      expect(callback).toHaveBeenCalledTimes(1);

      // The same index again should be suppressed (watermark dedup)
      wrappedCb(newEvent);
      expect(callback).toHaveBeenCalledTimes(1);
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

  describe('pull-mode transport correctness', () => {
    // A mock PubSub that behaves like Redis Streams: when subscribe() is
    // called, it immediately re-delivers the full backlog to the callback
    // (simulating XREADGROUP from id '0'). This exercises the buffering
    // and dedup paths that EventEmitterPubSub never triggers.
    class PullModePubSub extends PubSub {
      private published: Event[] = [];
      private listeners: Map<string, Set<EventCallback>> = new Map();
      private acked: Event[] = [];

      async publish(_topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
        const full: Event = {
          ...event,
          id: crypto.randomUUID(),
          createdAt: new Date(),
        } as Event;
        this.published.push(full);
        // Deliver to existing listeners
        const cbs = this.listeners.get(_topic);
        if (cbs) {
          for (const cb of cbs)
            cb(full, async () => {
              this.acked.push(full);
            });
        }
      }

      async subscribe(_topic: string, cb: EventCallback): Promise<void> {
        let cbs = this.listeners.get(_topic);
        if (!cbs) {
          cbs = new Set();
          this.listeners.set(_topic, cbs);
        }
        cbs.add(cb);
        // Re-deliver full backlog immediately (pull-mode behavior)
        for (const event of this.published) {
          cb(event, async () => {
            this.acked.push(event);
          });
        }
      }

      async unsubscribe(_topic: string, cb: EventCallback): Promise<void> {
        this.listeners.get(_topic)?.delete(cb);
      }

      async flush(): Promise<void> {}

      getAckedIndices(): number[] {
        return this.acked.map(event => event.index!);
      }

      emitLiveOnly(
        topic: string,
        event: Event,
        ack?: Parameters<EventCallback>[1],
        nack?: Parameters<EventCallback>[2],
      ): void {
        const cbs = this.listeners.get(topic);
        if (cbs) {
          for (const cb of cbs) cb(event, ack, nack);
        }
      }
    }

    it('delivers history before live events even on pull-mode transports', async () => {
      const pullInner = new PullModePubSub();
      const pullCaching = new CachingPubSub(pullInner, cache);
      const topic = 'pull-order';

      // Publish 3 events that will be in the backlog
      await pullCaching.publish(topic, { type: 'e0', runId: 'r', data: {} });
      await pullCaching.publish(topic, { type: 'e1', runId: 'r', data: {} });
      await pullCaching.publish(topic, { type: 'e2', runId: 'r', data: {} });

      const received: number[] = [];
      await pullCaching.subscribeWithReplay(topic, (event: Event) => {
        received.push(event.index!);
      });

      // Events must arrive in index order, no duplicates
      expect(received).toEqual([0, 1, 2]);
    });

    it('honors offset on live path for pull-mode transports', async () => {
      const pullInner = new PullModePubSub();
      const pullCaching = new CachingPubSub(pullInner, cache);
      const topic = 'pull-offset';

      // Publish 5 events
      for (let i = 0; i < 5; i++) {
        await pullCaching.publish(topic, { type: `e${i}`, runId: 'r', data: {} });
      }

      const received: number[] = [];
      await pullCaching.subscribeFromOffset(topic, 3, (event: Event) => {
        received.push(event.index!);
      });

      // Only events with index >= 3 should be delivered
      expect(received).toEqual([3, 4]);
    });

    it('delivers events published during getHistory bootstrap without duplication', async () => {
      const pullInner = new PullModePubSub();
      const pullCaching = new CachingPubSub(pullInner, cache);
      const topic = 'pull-bootstrap-race';

      // Pre-fill 2 events
      await pullCaching.publish(topic, { type: 'e0', runId: 'r', data: {} });
      await pullCaching.publish(topic, { type: 'e1', runId: 'r', data: {} });

      // Publish during getHistory to simulate the race
      const realGetHistory = pullCaching.getHistory.bind(pullCaching);
      let raced = false;
      vi.spyOn(pullCaching, 'getHistory').mockImplementation(async (t: string, offset?: number) => {
        if (!raced) {
          raced = true;
          await pullCaching.publish(topic, { type: 'e2', runId: 'r', data: {} });
        }
        return realGetHistory(t, offset);
      });

      const received: number[] = [];
      await pullCaching.subscribeWithReplay(topic, (event: Event) => {
        received.push(event.index!);
      });

      // All 3 events, each exactly once, in order
      expect(received).toEqual([0, 1, 2]);
    });

    it('live events after bootstrap are delivered in steady state', async () => {
      const pullInner = new PullModePubSub();
      const pullCaching = new CachingPubSub(pullInner, cache);
      const topic = 'pull-steady-state';

      await pullCaching.publish(topic, { type: 'e0', runId: 'r', data: {} });

      const received: number[] = [];
      await pullCaching.subscribeWithReplay(topic, (event: Event) => {
        received.push(event.index!);
      });

      expect(received).toEqual([0]);

      // Publish after bootstrap — should be delivered normally
      await pullCaching.publish(topic, { type: 'e1', runId: 'r', data: {} });
      await pullCaching.publish(topic, { type: 'e2', runId: 'r', data: {} });

      expect(received).toEqual([0, 1, 2]);
    });

    it('allows nack-redelivered events through even when index <= lastDelivered', async () => {
      const pullInner = new PullModePubSub();
      const pullCaching = new CachingPubSub(pullInner, cache);
      const topic = 'pull-nack-retry';

      await pullCaching.publish(topic, { type: 'e0', runId: 'r', data: {} });
      await pullCaching.publish(topic, { type: 'e1', runId: 'r', data: {} });

      const received: Array<{ index: number; attempt: number | undefined }> = [];
      await pullCaching.subscribeWithReplay(topic, (event: Event) => {
        received.push({ index: event.index!, attempt: event.deliveryAttempt });
      });

      expect(received).toEqual([
        { index: 0, attempt: undefined },
        { index: 1, attempt: undefined },
      ]);

      // Simulate a nack redelivery: same index, deliveryAttempt > 1
      pullInner.emitLiveOnly(topic, {
        id: 'retry-id',
        type: 'e1',
        runId: 'r',
        data: {},
        createdAt: new Date(),
        index: 1,
        deliveryAttempt: 2,
      });

      expect(received).toHaveLength(3);
      expect(received[2]).toEqual({ index: 1, attempt: 2 });
    });

    it('cleans up wrappedCb when replay bootstrap fails', async () => {
      const pullInner = new PullModePubSub();
      const pullCaching = new CachingPubSub(pullInner, cache);
      const topic = 'pull-bootstrap-fail';

      await pullCaching.publish(topic, { type: 'e0', runId: 'r', data: {} });

      vi.spyOn(pullCaching, 'getHistory').mockRejectedValueOnce(new Error('cache down'));

      const cb = vi.fn();
      await expect(pullCaching.subscribeWithReplay(topic, cb)).rejects.toThrow('cache down');

      // wrappedCb should have been unsubscribed — new events must not reach cb
      pullInner.emitLiveOnly(topic, {
        id: 'after-fail',
        type: 'e1',
        runId: 'r',
        data: {},
        createdAt: new Date(),
        index: 1,
      });

      expect(cb).not.toHaveBeenCalled();
    });

    it('preserves ack and nack handles for buffered live events that are delivered after history', async () => {
      const pullInner = new PullModePubSub();
      const pullCaching = new CachingPubSub(pullInner, cache);
      const topic = 'pull-buffer-handles';

      await pullCaching.publish(topic, { type: 'e0', runId: 'r', data: {} });

      const realGetHistory = pullCaching.getHistory.bind(pullCaching);
      let raced = false;
      const ackedByConsumer: number[] = [];
      vi.spyOn(pullCaching, 'getHistory').mockImplementation(async (t: string, offset?: number) => {
        if (!raced) {
          raced = true;
          pullInner.emitLiveOnly(
            topic,
            {
              id: 'live-only',
              type: 'e1',
              runId: 'r',
              data: {},
              createdAt: new Date(),
              index: 1,
            },
            async () => {
              ackedByConsumer.push(1);
            },
            async () => {},
          );
        }
        return realGetHistory(t, offset);
      });

      const received: number[] = [];
      await pullCaching.subscribeWithReplay(topic, (event: Event, ack, nack) => {
        received.push(event.index!);
        if (event.index === 1) {
          expect(nack).toBeDefined();
          void ack?.().then(() => ackedByConsumer.push(event.index!));
        }
      });

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(received).toEqual([0, 1]);
      expect(ackedByConsumer).toEqual([1, 1]);
    });
  });
});
