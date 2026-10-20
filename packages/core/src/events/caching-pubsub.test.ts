import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryServerCache } from '../cache/inmemory';
import { CachingPubSub, withCaching } from './caching-pubsub';
import { EventEmitterPubSub } from './event-emitter';
import { isLeaseProvider, PubSub } from './pubsub';
import type { Event, EventCallback, SubscribeOptions } from './types';

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

    describe('localOnly', () => {
      // `localOnly` events are never relayed to other instances, so nothing can
      // replay them from the shared cache. Caching them grows the store without
      // bound — `workflow.events.v2.*` watch events carry cumulative step results
      // and run to megabytes each.
      it('should not cache localOnly events', async () => {
        const topic = 'workflow.events.v2.run-1';

        await cachingPubsub.publish(
          topic,
          { type: 'watch', runId: 'run-1', data: { big: 'payload' } },
          {
            localOnly: true,
          },
        );
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(await cachingPubsub.getHistory(topic)).toHaveLength(0);
      });

      it('should not allocate an index counter for localOnly events', async () => {
        const topic = 'workflow.events.v2.run-2';

        await cachingPubsub.publish(topic, { type: 'watch', runId: 'run-2', data: {} }, { localOnly: true });
        await new Promise(resolve => setTimeout(resolve, 10));

        // A counter key would survive the run and leak forever, since nothing
        // clears a topic that was never cached.
        expect(await cache.get(`pubsub:${topic}:counter`)).toBeUndefined();
      });

      it('should still deliver localOnly events live to subscribers', async () => {
        const topic = 'local-live-topic';
        const receivedEvents: Event[] = [];

        await cachingPubsub.subscribe(topic, event => {
          receivedEvents.push(event);
        });

        await cachingPubsub.publish(
          topic,
          { type: 'watch', runId: 'run-1', data: { foo: 'bar' } },
          {
            localOnly: true,
          },
        );

        expect(receivedEvents).toHaveLength(1);
        expect(receivedEvents[0]).toMatchObject({ type: 'watch', runId: 'run-1', data: { foo: 'bar' } });
        expect(receivedEvents[0].id).toBeDefined();
        expect(receivedEvents[0].createdAt).toBeInstanceOf(Date);
        // No index: the event was never assigned one from the counter.
        expect(receivedEvents[0].index).toBeUndefined();
      });

      it('should forward the localOnly option to the inner pubsub', async () => {
        const topic = 'local-forward-topic';
        const publishSpy = vi.spyOn(innerPubsub, 'publish');

        await cachingPubsub.publish(topic, { type: 'watch', runId: 'run-1', data: {} }, { localOnly: true });

        expect(publishSpy).toHaveBeenCalledWith(topic, expect.objectContaining({ type: 'watch' }), {
          localOnly: true,
        });
      });

      it('should keep cached indices gap-free across interleaved localOnly publishes', async () => {
        const topic = 'mixed-topic';

        await cachingPubsub.publish(topic, { type: 'cached-first', runId: 'run-1', data: {} });
        await cachingPubsub.publish(topic, { type: 'local', runId: 'run-1', data: {} }, { localOnly: true });
        await cachingPubsub.publish(topic, { type: 'cached-second', runId: 'run-1', data: {} });
        await new Promise(resolve => setTimeout(resolve, 10));

        const history = await cachingPubsub.getHistory(topic);
        expect(history.map(event => [event.type, event.index])).toEqual([
          ['cached-first', 0],
          ['cached-second', 1],
        ]);
      });

      it('should deliver live localOnly events to a replay subscriber without caching them', async () => {
        const topic = 'replay-mixed-topic';
        const receivedEvents: Event[] = [];

        await cachingPubsub.publish(topic, { type: 'cached-first', runId: 'run-1', data: {} });
        await new Promise(resolve => setTimeout(resolve, 10));

        await cachingPubsub.subscribeWithReplay(topic, event => {
          receivedEvents.push(event);
        });

        await cachingPubsub.publish(topic, { type: 'local', runId: 'run-1', data: {} }, { localOnly: true });
        await cachingPubsub.publish(topic, { type: 'cached-second', runId: 'run-1', data: {} });
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(receivedEvents.map(event => event.type)).toEqual(['cached-first', 'local', 'cached-second']);
        expect(await cachingPubsub.getHistory(topic)).toHaveLength(2);
      });
    });

    describe('shouldCache', () => {
      // `localOnly` is not always visible to this layer: when the inner PubSub
      // is what decides `localOnly` (e.g. the `mastra.pubsub` proxy), the cache
      // runs above that decision and never sees the flag. `shouldCache` lets the
      // policy be declared at construction time instead.
      const uncachedTopic = 'workflow.events.v2.run-1';
      const cachedTopic = 'agent.stream.run-1';
      let policyPubsub: CachingPubSub;

      beforeEach(() => {
        policyPubsub = new CachingPubSub(innerPubsub, cache, {
          shouldCache: topic => !topic.startsWith('workflow.events.v2.'),
        });
      });

      it('should not cache topics rejected by shouldCache', async () => {
        await policyPubsub.publish(uncachedTopic, { type: 'watch', runId: 'run-1', data: { big: 'payload' } });
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(await policyPubsub.getHistory(uncachedTopic)).toHaveLength(0);
      });

      it('should not allocate an index counter for topics rejected by shouldCache', async () => {
        await policyPubsub.publish(uncachedTopic, { type: 'watch', runId: 'run-1', data: {} });
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(await cache.get(`pubsub:${uncachedTopic}:counter`)).toBeUndefined();
      });

      it('should still deliver rejected topics live to subscribers', async () => {
        const receivedEvents: Event[] = [];
        await policyPubsub.subscribe(uncachedTopic, event => {
          receivedEvents.push(event);
        });

        await policyPubsub.publish(uncachedTopic, { type: 'watch', runId: 'run-1', data: { foo: 'bar' } });

        expect(receivedEvents).toHaveLength(1);
        expect(receivedEvents[0]).toMatchObject({ type: 'watch', runId: 'run-1', data: { foo: 'bar' } });
        expect(receivedEvents[0].index).toBeUndefined();
      });

      it('should still cache topics accepted by shouldCache', async () => {
        await policyPubsub.publish(cachedTopic, { type: 'text-delta', runId: 'run-1', data: {} });
        await new Promise(resolve => setTimeout(resolve, 10));

        const history = await policyPubsub.getHistory(cachedTopic);
        expect(history).toHaveLength(1);
        expect(history[0].index).toBe(0);
      });

      it('should cache everything when shouldCache is not provided', async () => {
        await cachingPubsub.publish(uncachedTopic, { type: 'watch', runId: 'run-1', data: {} });
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(await cachingPubsub.getHistory(uncachedTopic)).toHaveLength(1);
      });

      it('should keep cached indices gap-free across interleaved rejected publishes', async () => {
        await policyPubsub.publish(cachedTopic, { type: 'cached-first', runId: 'run-1', data: {} });
        await policyPubsub.publish(uncachedTopic, { type: 'watch', runId: 'run-1', data: {} });
        await policyPubsub.publish(cachedTopic, { type: 'cached-second', runId: 'run-1', data: {} });
        await new Promise(resolve => setTimeout(resolve, 10));

        const history = await policyPubsub.getHistory(cachedTopic);
        expect(history.map(event => [event.type, event.index])).toEqual([
          ['cached-first', 0],
          ['cached-second', 1],
        ]);
      });

      it('should deliver live events on a rejected topic to a replay subscriber with nothing to replay', async () => {
        const receivedEvents: Event[] = [];

        await policyPubsub.publish(uncachedTopic, { type: 'before-subscribe', runId: 'run-1', data: {} });
        await new Promise(resolve => setTimeout(resolve, 10));

        await policyPubsub.subscribeWithReplay(uncachedTopic, event => {
          receivedEvents.push(event);
        });

        await policyPubsub.publish(uncachedTopic, { type: 'after-subscribe', runId: 'run-1', data: {} });
        await new Promise(resolve => setTimeout(resolve, 10));

        // Nothing replayed — the pre-subscribe event was never cached.
        expect(receivedEvents.map(event => event.type)).toEqual(['after-subscribe']);
        expect(await policyPubsub.getHistory(uncachedTopic)).toHaveLength(0);
      });

      it('should still bypass the cache for localOnly publishes on accepted topics', async () => {
        await policyPubsub.publish(cachedTopic, { type: 'watch', runId: 'run-1', data: {} }, { localOnly: true });
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(await policyPubsub.getHistory(cachedTopic)).toHaveLength(0);
      });
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

    it('forwards options (including startFrom and batch) verbatim to the inner PubSub', async () => {
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
      const options = { startFrom: 'latest' as const, batch: { maxSize: 2, maxWaitMs: 50 } };
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

    it('reports support for numeric offsets', () => {
      expect(cachingPubsub.supportsOffsets).toBe(true);
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

    it('forwards clearTopic to an inner transport that implements it', async () => {
      // A persistent inner (e.g. Redis Streams) must be told to delete its
      // underlying stream — otherwise wrapping it in CachingPubSub turns
      // clearTopic into a cache-only no-op and the inner storage leaks.
      class ClearableInner extends PubSub {
        clearTopic = vi.fn(async (_topic: string) => {});
        async publish(): Promise<void> {}
        async subscribe(): Promise<void> {}
        async unsubscribe(): Promise<void> {}
        async flush(): Promise<void> {}
      }
      const inner = new ClearableInner();
      const wrapped = new CachingPubSub(inner, cache);

      await wrapped.clearTopic('some-topic');

      expect(inner.clearTopic).toHaveBeenCalledWith('some-topic');
    });

    it('does not throw when the inner transport does not override clearTopic', async () => {
      // EventEmitterPubSub retains nothing per topic and relies on the
      // PubSub base class's no-op clearTopic; forwarding must resolve cleanly.
      await expect(cachingPubsub.clearTopic('no-inner-hook')).resolves.toBeUndefined();
    });

    it('does not reject when the cache or inner transport fails', async () => {
      // The base-class contract says clearTopic is best-effort and
      // non-throwing: callers (DurableAgent, WorkflowEventProcessor) invoke
      // it fire-and-forget, so a rejection here would surface as an
      // unhandledRejection. Failures must be logged, not thrown.
      class FailingInner extends PubSub {
        override clearTopic = vi.fn(async (_topic: string) => {
          throw new Error('inner delete failed');
        });
        async publish(): Promise<void> {}
        async subscribe(): Promise<void> {}
        async unsubscribe(): Promise<void> {}
        async flush(): Promise<void> {}
      }
      const logger = { error: vi.fn() };
      const wrapped = new CachingPubSub(new FailingInner(), cache, { logger: logger as any });

      await expect(wrapped.clearTopic('failing-topic')).resolves.toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('failing-topic'), expect.any(Error));
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

    it('publishes through a single listPushIndexed cache call (no separate increment/listPush)', async () => {
      const topic = 'single-roundtrip-topic';
      const cache = new InMemoryServerCache();
      const indexedSpy = vi.spyOn(cache, 'listPushIndexed');

      const pubsub = new CachingPubSub(innerPubsub, cache);
      const callback = vi.fn();
      await pubsub.subscribe(topic, callback);
      await pubsub.publish(topic, { type: 'test', runId: 'run-1', data: { a: 1 } });

      expect(indexedSpy).toHaveBeenCalledTimes(1);
      expect(indexedSpy).toHaveBeenCalledWith(
        `pubsub:${topic}`,
        `pubsub:${topic}:counter`,
        expect.objectContaining({ type: 'test', runId: 'run-1', data: { a: 1 }, id: expect.any(String) }),
      );
      // The value handed to the cache must not carry a pre-assigned index
      expect(indexedSpy.mock.calls[0]![2]).not.toHaveProperty('index');

      // Live event carries the index the cache assigned
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ index: 0 }),
        expect.any(Function),
        expect.any(Function),
      );
      const cached = await cache.listFromTo(`pubsub:${topic}`, 0);
      expect(cached).toHaveLength(1);
      expect((cached[0] as any).index).toBe(0);
    });

    it('delivers live without an index when listPushIndexed fails', async () => {
      const topic = 'indexed-fail-topic';
      const cache = new InMemoryServerCache();
      cache.listPushIndexed = async () => {
        throw new Error('atomic write failed');
      };
      const pubsub = new CachingPubSub(innerPubsub, cache);
      const callback = vi.fn();
      await pubsub.subscribe(topic, callback);
      await pubsub.publish(topic, { type: 'test', runId: 'run-1', data: {} });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback.mock.calls[0]![0]).not.toHaveProperty('index');
      expect(await cache.listLength(`pubsub:${topic}`)).toBe(0);
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

  describe('source bus following', () => {
    const topic = 'agent.stream.run-1';
    const flush = () => new Promise(resolve => setTimeout(resolve, 20));

    /**
     * Mimics the `mastra.pubsub` proxy: same underlying transport, different
     * object identity, methods bound to the target. Aliasing detection must
     * see through it via `__rawBus()`.
     */
    function proxyOver(raw: PubSub): PubSub {
      return new Proxy(raw, {
        get(target, prop) {
          const val = Reflect.get(target, prop, target);
          return typeof val === 'function' ? val.bind(target) : val;
        },
      }) as PubSub;
    }

    it('delivers and caches source-published events when source is a different transport', async () => {
      const sourceBus = new EventEmitterPubSub();
      const caching = new CachingPubSub(new EventEmitterPubSub(), cache, { source: sourceBus });

      const received: Event[] = [];
      await caching.subscribe(topic, event => {
        received.push(event);
      });

      // Publish directly on the source bus — the follower must bridge it.
      await sourceBus.publish(topic, { type: 'chunk', runId: 'run-1', data: { n: 1 } });
      await flush();

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({ type: 'chunk', data: { n: 1 }, index: 0 });

      const history = await caching.getHistory(topic);
      expect(history).toHaveLength(1);
      expect(history[0].index).toBe(0);
    });

    it('acks every source delivery, including dedup-suppressed and cache-failure paths', async () => {
      // Pins the composition of two shipped behaviors: the source-follower
      // wiring (transport unification) and the pubsub ack contract (#24348).
      // On a durable source backend (Redis Streams, GCP Pub/Sub) the follower
      // is a real consumer — every delivery it filters out or fails to cache
      // must still be acked, or it stays pending and is redelivered forever.
      class AckRecordingSource extends PubSub {
        private listeners = new Map<string, Set<EventCallback>>();
        acked: Event[] = [];

        async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
          const full: Event = { ...event, id: crypto.randomUUID(), createdAt: new Date() } as Event;
          for (const cb of this.listeners.get(topic) ?? []) {
            await cb(full, async () => {
              this.acked.push(full);
            });
          }
        }

        async subscribe(topic: string, cb: EventCallback): Promise<void> {
          let cbs = this.listeners.get(topic);
          if (!cbs) {
            cbs = new Set();
            this.listeners.set(topic, cbs);
          }
          cbs.add(cb);
        }

        async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
          this.listeners.get(topic)?.delete(cb);
        }

        async flush(): Promise<void> {}
      }

      const sourceBus = new AckRecordingSource();
      const caching = new CachingPubSub(new EventEmitterPubSub(), cache, { source: sourceBus });
      await caching.subscribe(topic, () => {});

      // 1. Normal delivery: cached, republished, and acked.
      await sourceBus.publish(topic, { type: 'chunk', runId: 'run-1', data: { n: 1 } });
      expect(sourceBus.acked).toHaveLength(1);

      // 2. Foreign-indexed delivery on a non-aliased source (re-cached under a
      //    fresh index and republished): still acked.
      await sourceBus.publish(topic, { type: 'chunk', runId: 'run-1', data: { n: 2 }, index: 5 });
      expect(sourceBus.acked).toHaveLength(2);

      // 3. Cache write failure (falls back to uncached republish): still acked.
      const failingPush = vi.spyOn(cache, 'listPushIndexed').mockRejectedValueOnce(new Error('cache down'));
      await sourceBus.publish(topic, { type: 'chunk', runId: 'run-1', data: { n: 3 } });
      expect(sourceBus.acked).toHaveLength(3);
      failingPush.mockRestore();
    });

    it('replays source-published events to late subscribers', async () => {
      const sourceBus = new EventEmitterPubSub();
      const caching = new CachingPubSub(new EventEmitterPubSub(), cache, { source: sourceBus });

      // A first subscriber keeps the follower alive while events flow.
      await caching.subscribe(topic, () => {});
      await sourceBus.publish(topic, { type: 'first', runId: 'run-1', data: {} });
      await sourceBus.publish(topic, { type: 'second', runId: 'run-1', data: {} });
      await flush();

      const replayed: string[] = [];
      await caching.subscribeWithReplay(topic, event => {
        replayed.push(event.type);
      });
      await sourceBus.publish(topic, { type: 'third', runId: 'run-1', data: {} });
      await flush();

      expect(replayed).toEqual(['first', 'second', 'third']);
    });

    it('bridges foreign-indexed events when the source is another caching tier', async () => {
      // Supported topology: an agent with its own pubsub wraps it in its own
      // CachingPubSub and follows `mastra.pubsub` — which is itself a
      // user-supplied CachingPubSub over a *different* cache and transport
      // (`new Mastra({ pubsub: new CachingPubSub(...) })`). Events published
      // through the mastra tier arrive at the follower already carrying that
      // tier's index. They must NOT be treated as a local echo: the foreign
      // tier's cache is not the one this tier replays from, so dropping them
      // loses the event for local subscribers entirely (#20646's failure
      // mode). Expected: cached here under a fresh index and republished
      // into inner exactly once.
      const foreignTier = new CachingPubSub(new EventEmitterPubSub(), new InMemoryServerCache());
      const caching = new CachingPubSub(new EventEmitterPubSub(), cache, { source: foreignTier });

      // Bump the foreign tier's counter before anyone follows, so the foreign
      // index (1) is distinguishable from this tier's fresh index (0).
      await foreignTier.publish(topic, { type: 'warmup', runId: 'run-1', data: {} });

      const received: Event[] = [];
      await caching.subscribe(topic, event => {
        received.push(event);
      });

      await foreignTier.publish(topic, { type: 'chunk', runId: 'run-1', data: { n: 1 } });
      await flush();

      // Exactly one live delivery, carrying this tier's index — not the
      // foreign tier's.
      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({ type: 'chunk', data: { n: 1 }, index: 0 });

      // Cached in this tier, so late subscribers can replay it.
      const history = await caching.getHistory(topic);
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({ type: 'chunk', index: 0 });

      const replayed: string[] = [];
      await caching.subscribeWithReplay(topic, event => {
        replayed.push(event.type);
      });
      await flush();
      expect(replayed).toEqual(['chunk']);
    });

    it('does not double-deliver when source and inner share the transport', async () => {
      const shared = new EventEmitterPubSub();
      const caching = new CachingPubSub(shared, cache, { source: proxyOver(shared) });

      const received: Event[] = [];
      await caching.subscribe(topic, event => {
        received.push(event);
      });

      await shared.publish(topic, { type: 'chunk', runId: 'run-1', data: {} });
      await flush();

      // Exactly one live delivery (the original), but the event is cached.
      expect(received).toHaveLength(1);
      const history = await caching.getHistory(topic);
      expect(history).toHaveLength(1);
      expect(history[0].index).toBe(0);
      // Cached copy preserves the live id — subscribeFromOffset dedups the
      // unindexed live copy against the indexed cached copy by id.
      expect(history[0].id).toBe(received[0].id);
    });

    it('replay+live has no duplicates on an aliased bus', async () => {
      const shared = new EventEmitterPubSub();
      const caching = new CachingPubSub(shared, cache, { source: proxyOver(shared) });

      await caching.subscribe(topic, () => {});
      await shared.publish(topic, { type: 'first', runId: 'run-1', data: {} });
      await shared.publish(topic, { type: 'second', runId: 'run-1', data: {} });
      await flush();

      const replayed: string[] = [];
      await caching.subscribeWithReplay(topic, event => {
        replayed.push(event.type);
      });
      await shared.publish(topic, { type: 'third', runId: 'run-1', data: {} });
      await flush();

      expect(replayed).toEqual(['first', 'second', 'third']);
    });

    it('ignores its own indexed publishes on an aliased bus (no double cache)', async () => {
      const shared = new EventEmitterPubSub();
      const caching = new CachingPubSub(shared, cache, { source: proxyOver(shared) });

      const received: Event[] = [];
      await caching.subscribe(topic, event => {
        received.push(event);
      });

      await caching.publish(topic, { type: 'chunk', runId: 'run-1', data: {} });
      await flush();

      expect(received).toHaveLength(1);
      const history = await caching.getHistory(topic);
      expect(history).toHaveLength(1);
    });

    it('respects the shouldCache policy for followed events', async () => {
      const sourceBus = new EventEmitterPubSub();
      const caching = new CachingPubSub(new EventEmitterPubSub(), cache, {
        source: sourceBus,
        shouldCache: () => false,
      });

      const received: Event[] = [];
      await caching.subscribe(topic, event => {
        received.push(event);
      });

      await sourceBus.publish(topic, { type: 'chunk', runId: 'run-1', data: {} });
      await flush();

      // Still forwarded live across the split transports, but never cached.
      expect(received).toHaveLength(1);
      expect(received[0].index).toBeUndefined();
      expect(await caching.getHistory(topic)).toHaveLength(0);
    });

    it('stops following when the last local subscriber unsubscribes', async () => {
      const sourceBus = new EventEmitterPubSub();
      const caching = new CachingPubSub(new EventEmitterPubSub(), cache, { source: sourceBus });

      const cb = vi.fn();
      await caching.subscribe(topic, cb);
      await caching.unsubscribe(topic, cb);

      await sourceBus.publish(topic, { type: 'chunk', runId: 'run-1', data: {} });
      await flush();

      expect(cb).not.toHaveBeenCalled();
      expect(await caching.getHistory(topic)).toHaveLength(0);
    });

    it('clearTopic tears down the follower', async () => {
      const sourceBus = new EventEmitterPubSub();
      const caching = new CachingPubSub(new EventEmitterPubSub(), cache, { source: sourceBus });

      await caching.subscribe(topic, () => {});
      await sourceBus.publish(topic, { type: 'before', runId: 'run-1', data: {} });
      await flush();
      expect(await caching.getHistory(topic)).toHaveLength(1);

      await caching.clearTopic(topic);
      await sourceBus.publish(topic, { type: 'after', runId: 'run-1', data: {} });
      await flush();

      expect(await caching.getHistory(topic)).toHaveLength(0);
    });

    it('__setSource wires a source after construction', async () => {
      const sourceBus = new EventEmitterPubSub();
      const caching = new CachingPubSub(new EventEmitterPubSub(), cache);
      caching.__setSource(sourceBus);

      const received: Event[] = [];
      await caching.subscribe(topic, event => {
        received.push(event);
      });

      await sourceBus.publish(topic, { type: 'chunk', runId: 'run-1', data: {} });
      await flush();

      expect(received).toHaveLength(1);
      expect(await caching.getHistory(topic)).toHaveLength(1);
    });

    it('releases a follower from the source it subscribed to after source replacement', async () => {
      const firstSource = new EventEmitterPubSub();
      const secondSource = new EventEmitterPubSub();
      const caching = new CachingPubSub(new EventEmitterPubSub(), cache, { source: firstSource });
      const callback = vi.fn();

      await caching.subscribe(topic, callback);
      caching.__setSource(secondSource);
      await caching.unsubscribe(topic, callback);

      await firstSource.publish(topic, { type: 'after-unsubscribe', runId: 'run-1', data: {} });
      await flush();

      expect(callback).not.toHaveBeenCalled();
      expect(await caching.getHistory(topic)).toHaveLength(0);
    });
  });

  describe('retaining transport', () => {
    const topic = 'agent.stream.run-1';
    const flush = () => new Promise(resolve => setTimeout(resolve, 20));

    /**
     * Stand-in for a retaining backend (Redis Streams, …): it keeps every event
     * it is handed and replays that retained history in full to each new
     * subscription unless the subscriber asks to start at the latest. The same
     * event object (same id) is delivered live and replayed from storage, which
     * is what makes id-based dedupe possible for an unnumbered publisher.
     * `EventEmitterPubSub` retains nothing and mints a new id per publish, so an
     * in-process bus never exposed this — which is why the duplication only
     * showed up in a real deployment.
     */
    class RetainingPubSub extends PubSub {
      readonly retained = new Map<string, Event[]>();
      readonly subscribeOptions: Array<SubscribeOptions | undefined> = [];
      private readonly listeners = new Map<string, Set<EventCallback>>();
      /** Publishes at the exact moment a subscription goes live, before it resolves. */
      onLiveAttach?: (topic: string) => void | Promise<void>;

      async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>) {
        const full: Event = { ...event, id: crypto.randomUUID(), createdAt: new Date(), deliveryAttempt: 1 };
        const retained = this.retained.get(topic) ?? [];
        retained.push(full);
        this.retained.set(topic, retained);
        for (const cb of this.listeners.get(topic) ?? []) {
          await cb(full);
        }
      }

      async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions) {
        this.subscribeOptions.push(options);
        if (options?.startFrom !== 'latest') {
          for (const event of this.retained.get(topic) ?? []) {
            await cb(event);
          }
        }
        const listeners = this.listeners.get(topic) ?? new Set<EventCallback>();
        listeners.add(cb);
        this.listeners.set(topic, listeners);
        await this.onLiveAttach?.(topic);
      }

      async unsubscribe(topic: string, cb: EventCallback) {
        this.listeners.get(topic)?.delete(cb);
      }

      async flush() {}
    }

    /** A run whose events reached the shared transport and the shared cache. */
    async function runWithFourEvents() {
      const inner = new RetainingPubSub();
      const caching = new CachingPubSub(inner, cache, { source: inner });
      const stream = () => {};

      // A subscriber is attached while the run publishes, so the follower caches
      // the transport's events under indices (the real "observe a live run" setup).
      await caching.subscribe(topic, stream);
      for (let n = 0; n < 4; n++) {
        await inner.publish(topic, { type: 'chunk', runId: 'run-1', data: { n } });
      }
      await flush();
      await caching.unsubscribe(topic, stream);

      return { inner, caching };
    }

    it('drops the retained transport copies of frames before and after the offset', async () => {
      const { caching } = await runWithFourEvents();
      const received: Event[] = [];

      await caching.subscribeFromOffset(topic, 2, event => {
        received.push(event);
      });
      await flush();

      // The subscriber asked for frames 2..3. The transport replays its retained
      // copy of frames 0..3 as well; those copies are unnumbered (they never
      // passed through this cache), so the offset filter can't see them and they
      // are suppressed by id instead — including 0..1, which are before the
      // offset and would otherwise have ignored it.
      expect(received.map(event => event.data.n)).toEqual([2, 3]);
      expect(received.map(event => event.index)).toEqual([2, 3]);
    });

    it('does not ask the transport to skip its history, so a cold cache can still rebuild from it', async () => {
      const { inner, caching } = await runWithFourEvents();
      const before = inner.subscribeOptions.length;

      await caching.subscribeFromOffset(topic, 0, () => {});
      await flush();

      // `startFrom` is left at the transport default ('earliest') for the
      // observer's own subscription (the follower's re-attach above it is
      // deliberately live-only — it caches what it sees, replay is the cache's
      // job): on a cold cache the retained events are the only copy of the run,
      // and they carry the index they were published with once numbering is in
      // place.
      expect(inner.subscribeOptions.slice(before).at(-1)).toBeUndefined();
    });

    it('still delivers events published after the subscriber attaches', async () => {
      const { inner, caching } = await runWithFourEvents();
      const received: Event[] = [];

      await caching.subscribeFromOffset(topic, 0, event => {
        received.push(event);
      });
      await flush();
      await inner.publish(topic, { type: 'chunk', runId: 'run-1', data: { n: 4 } });
      await flush();

      expect(received.map(event => event.data.n)).toEqual([0, 1, 2, 3, 4]);
    });

    it('does not drop an event published between the live attach and the cache read', async () => {
      const inner = new RetainingPubSub();
      const caching = new CachingPubSub(inner, cache, { source: inner });
      const keepAlive = () => {};

      // Keep the follower attached, as an ongoing live stream would, so the only
      // subscription `subscribeFromOffset` opens below is the observer's own.
      await caching.subscribe(topic, keepAlive);
      for (let n = 0; n < 4; n++) {
        await inner.publish(topic, { type: 'chunk', runId: 'run-1', data: { n } });
      }
      await flush();

      // Publish from inside the transport's subscribe: the observer's live
      // listener exists, but `subscribeFromOffset` has not read the cache
      // snapshot yet. This is the window `startFrom: 'latest'` could lose an
      // event in — it cannot, because the live subscribe is awaited before the
      // history fetch, so the event is buffered and then deduped against history
      // by index/id.
      inner.onLiveAttach = async attachedTopic => {
        await inner.publish(attachedTopic, { type: 'chunk', runId: 'run-1', data: { n: 4 } });
      };

      const received: Event[] = [];
      await caching.subscribeFromOffset(topic, 0, event => {
        received.push(event);
      });
      await flush();
      await caching.unsubscribe(topic, keepAlive);

      expect(received.map(event => event.data.n)).toEqual([0, 1, 2, 3, 4]);
    });

    it('delivers exact-sequenced frames that reach the transport out of order exactly once', async () => {
      const inner = new RetainingPubSub();
      const caching = new CachingPubSub(inner, cache, { source: inner });
      const received: Event[] = [];

      await caching.subscribeFromOffset(topic, 0, event => {
        received.push(event);
      });
      await flush();

      // Two processes allocate 5 and 6 from the shared counter; the transport
      // can hand them over in either order. Their frames carry `streamSeq`
      // rather than `index` so that older subscribers still see them as
      // unnumbered, which is what the pre-change code delivered.
      const exactFrame = (n: number, streamSeq: number): Omit<Event, 'id' | 'createdAt'> => ({
        type: 'chunk',
        runId: 'run-1',
        data: { n },
        indexMode: 'exact',
        streamSeq,
      });
      await inner.publish(topic, exactFrame(6, 6));
      await inner.publish(topic, exactFrame(5, 5));
      // A duplicate of a sequence that is still above the floor is dropped.
      await inner.publish(topic, exactFrame(6, 6));
      await flush();

      expect(received.map(event => event.streamSeq)).toEqual([6, 5]);
    });

    it('leaves watermark-kind frames on today’s high-water-mark behavior', async () => {
      const inner = new RetainingPubSub();
      const caching = new CachingPubSub(inner, cache, { source: inner });
      const received: Event[] = [];

      await caching.subscribeFromOffset(topic, 0, event => {
        received.push(event);
      });
      await flush();

      // A frame whose index comes from a single per-process counter is still
      // treated as before: anything at or below the highest index seen is a
      // stale frame from a discarded attempt, so 8 after 9 never surfaces.
      await inner.publish(topic, { type: 'chunk', runId: 'run-1', data: { n: 9 }, index: 9 });
      await inner.publish(topic, { type: 'chunk', runId: 'run-1', data: { n: 8 }, index: 8 });
      await flush();

      expect(received.map(event => event.data.n)).toEqual([9]);
    });

    it('applies each dedupe discipline to its own frames on a shared topic', async () => {
      const inner = new RetainingPubSub();
      const caching = new CachingPubSub(inner, cache, { source: inner });
      const received: Event[] = [];

      await caching.subscribeFromOffset(topic, 0, event => {
        received.push(event);
      });
      await flush();

      // Exact frames from step workers and watermark frames from an agent’s own
      // publisher share this run topic. Neither discipline may advance state the
      // other reads: the exact floor must not swallow the late watermark frame,
      // and the watermark must not swallow a hole the exact path still tracks.
      await inner.publish(topic, { type: 'chunk', runId: 'run-1', data: { n: 6 }, indexMode: 'exact', streamSeq: 6 });
      await inner.publish(topic, { type: 'chunk', runId: 'run-1', data: { n: 5 }, indexMode: 'exact', streamSeq: 5 });
      await inner.publish(topic, { type: 'chunk', runId: 'run-1', data: { n: 9 }, index: 9 });
      await inner.publish(topic, { type: 'chunk', runId: 'run-1', data: { n: 8 }, index: 8 });
      await flush();

      expect(received.map(event => event.data.n)).toEqual([6, 5, 9]);
    });

    it('replays one frame when a follower sees a frame another tier already cached', async () => {
      // Two pubsub instances that share a cache but not a bus: a step publishes
      // on one, the agent follows it from the other. The step cached its frame
      // under an exact index; the follower recognises that entry in the shared
      // history and only forwards the frame, instead of storing a second copy
      // under a fresh index that replay would also deliver.
      const stepBus = new RetainingPubSub();
      const agentBus = new RetainingPubSub();
      const stepPubsub = new CachingPubSub(stepBus, cache, { indexMode: 'exact' });
      const agentPubsub = new CachingPubSub(agentBus, cache, { source: stepBus });

      // Attach first: the follower listens to its source with `startFrom: 'latest'`.
      const live: Event[] = [];
      await agentPubsub.subscribeFromOffset(topic, 0, event => {
        live.push(event);
      });

      await stepPubsub.publish(topic, { type: 'chunk', runId: 'run-1', data: { n: 0 } });
      await flush();

      const replayed: Event[] = [];
      await agentPubsub.subscribeFromOffset(topic, 0, event => {
        replayed.push(event);
      });
      await flush();

      expect(live.map(event => event.data)).toEqual([{ n: 0 }]);
      expect(replayed.map(event => event.data)).toEqual([{ n: 0 }]);
    });

    it('replays one frame when the list expired before another tier cached it', async () => {
      // Same shared cache across two buses, but the list TTL elapsed first: the
      // surviving counter hands the next frame index 4 into a list that starts at
      // position 0. Recognising that entry must not assume index == position, or
      // the follower stores it again and replay carries it twice.
      const stepBus = new RetainingPubSub();
      const agentBus = new RetainingPubSub();
      const stepPubsub = new CachingPubSub(stepBus, cache, { indexMode: 'exact' });
      const agentPubsub = new CachingPubSub(agentBus, cache, { source: stepBus });

      const live: Event[] = [];
      await agentPubsub.subscribeFromOffset(topic, 0, event => {
        live.push(event);
      });
      for (let n = 0; n < 4; n++) {
        await stepPubsub.publish(topic, { type: 'chunk', runId: 'run-1', data: { n } });
      }
      await flush();

      await cache.delete(`pubsub:${topic}`);
      await stepPubsub.publish(topic, { type: 'chunk', runId: 'run-1', data: { n: 4 } });
      await flush();

      expect(live.map(event => event.data.n)).toEqual([0, 1, 2, 3, 4]);

      const history = await agentPubsub.getHistory(topic, 0);
      expect(history.map(event => event.data.n)).toEqual([4]);
      expect(history.map(event => event.index)).toEqual([4]);
      // One allocation for the frame: the follower forwarded it, not re-stored it.
      expect(await cache.get(`pubsub:${topic}:counter`)).toBe(5);
    });

    it('is seen as unnumbered by a subscriber running the pre-#27352 dedupe', async () => {
      /**
       * Rollout compatibility: an older API process may observe a run while a
       * newer worker publishes exact-sequenced frames. The old subscriber reads
       * `index` only, so a transport frame without a numeric `index` takes its
       * unnumbered path and is delivered — it must never be dropped by a
       * watermark it cannot even see.
       */
      const legacyDeliver = (events: Event[]): Event[] => {
        let lastDelivered = -1;
        const out: Event[] = [];
        for (const event of events) {
          const isRetry = typeof event.deliveryAttempt === 'number' && event.deliveryAttempt > 1;
          if (typeof event.index === 'number') {
            if (!isRetry && event.index <= lastDelivered) continue;
            lastDelivered = Math.max(lastDelivered, event.index);
          }
          out.push(event);
        }
        return out;
      };

      const inner = new RetainingPubSub();
      const publisher = new CachingPubSub(inner, cache, { indexMode: 'exact' });
      await publisher.publish(topic, { type: 'chunk', runId: 'run-1', data: { n: 5 } });

      // What the transport actually hands an old subscriber: the frame the
      // exact publisher emitted, with `streamSeq` in place of `index`.
      const frames = inner.retained.get(topic)!;
      expect(frames.map(event => event.index)).toEqual([undefined]);
      expect(legacyDeliver(frames).map(event => event.data.n)).toEqual([5]);

      // And when two workers' frames arrive as 6 then 5, the old subscriber
      // delivers both — exactly what it did before this change.
      const outOfOrder: Event[] = [
        {
          id: 'frame-6',
          createdAt: new Date(),
          type: 'chunk',
          runId: 'run-1',
          data: { n: 6 },
          indexMode: 'exact',
          streamSeq: 6,
        },
        {
          id: 'frame-5',
          createdAt: new Date(),
          type: 'chunk',
          runId: 'run-1',
          data: { n: 5 },
          indexMode: 'exact',
          streamSeq: 5,
        },
      ];
      expect(legacyDeliver(outOfOrder).map(event => event.data.n)).toEqual([6, 5]);
    });

    it('rebuilds a cold cache from the numbered retained history at an offset', async () => {
      const inner = new RetainingPubSub();
      const publisher = new CachingPubSub(inner, cache);
      for (let n = 0; n < 4; n++) {
        await publisher.publish(topic, { type: 'chunk', runId: 'run-1', data: { n } });
      }
      await flush();

      // A process that restarted has an empty cache but the same transport: the
      // retained copies carry their index now, so the offset applies to them and
      // the run can be resumed without re-delivering the whole prefix.
      const restarted = new CachingPubSub(inner, new InMemoryServerCache());
      const received: Event[] = [];
      await restarted.subscribeFromOffset(topic, 2, event => {
        received.push(event);
      });
      await flush();

      expect(received.map(event => event.index)).toEqual([2, 3]);
      expect(received.map(event => event.data.n)).toEqual([2, 3]);
    });

    it('re-reads the whole list when a positional slice is not in index order', async () => {
      /**
       * A cache without the atomic allocate+append pair can interleave two
       * publishers, so the list position of an entry no longer matches its
       * index and slicing by position returns the wrong window.
       */
      class InterleavedCache extends InMemoryServerCache {
        override async listFromTo(key: string, from: number, to?: number) {
          const full = (await super.listFromTo(key, 0)) as Event[];
          if (from === 0) return full as never;
          const slice = (await super.listFromTo(key, from, to)) as Event[];
          return [...slice].reverse() as never;
        }
      }

      const interleaved = new InterleavedCache();
      const publisher = new CachingPubSub(new EventEmitterPubSub(), interleaved);
      for (let n = 0; n < 4; n++) {
        await publisher.publish(topic, { type: 'chunk', runId: 'run-1', data: { n } });
      }

      const history = await publisher.getHistory(topic, 1);
      expect(history.map(event => event.index)).toEqual([1, 2, 3]);
    });

    it('finds the frames after a list that expired while its counter survived', async () => {
      /**
       * The index counter deliberately outlives the list it indexes (see
       * `counterTtlSeconds`): a run can sit silent inside one tool call for
       * longer than the list TTL. When the list expires mid-run the next
       * publish allocates a non-zero index into a fresh, short list, so slicing
       * by position returns an empty window for an offset the new frames are
       * still above. An empty slice proves nothing — re-read and filter.
       */
      const inner = new RetainingPubSub();
      const publisher = new CachingPubSub(inner, cache, { indexMode: 'exact' });
      for (let n = 0; n < 4; n++) {
        await publisher.publish(topic, { type: 'chunk', runId: 'run-1', data: { n } });
      }

      // The list key expires; the counter key (a separate entry) does not.
      await cache.delete(`pubsub:${topic}`);
      for (let n = 4; n < 6; n++) {
        await publisher.publish(topic, { type: 'chunk', runId: 'run-1', data: { n } });
      }
      expect(await cache.listFromTo(`pubsub:${topic}`, 0)).toHaveLength(2);
      expect(await cache.get(`pubsub:${topic}:counter`)).toBe(6);

      const history = await publisher.getHistory(topic, 4);
      expect(history.map(event => event.index)).toEqual([4, 5]);

      // A subscriber reconnecting at the offset sees the surviving frames once.
      const restarted = new CachingPubSub(inner, new InMemoryServerCache(), { indexMode: 'exact' });
      const received: Event[] = [];
      await restarted.subscribeFromOffset(topic, 4, event => {
        received.push(event);
      });
      await flush();

      expect(received.map(event => event.streamSeq ?? event.index)).toEqual([4, 5]);
    });
  });
});
