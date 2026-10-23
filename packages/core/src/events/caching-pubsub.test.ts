import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MastraServerCache } from '../cache/base';
import { InMemoryServerCache } from '../cache/inmemory';
import type { IMastraLogger } from '../logger';
import { CachingPubSub, withCaching } from './caching-pubsub';
import { EventEmitterPubSub } from './event-emitter';
import { isLeaseProvider, PubSub } from './pubsub';
import { RUN_LOG_TTL_MS } from './topics';
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

      // Force the race: publish "2" while the subscriber is reading the log, so
      // it lands in both the live stream and the replayed history.
      const realListFromTo = cache.listFromTo.bind(cache);
      let raced = false;
      vi.spyOn(cache, 'listFromTo').mockImplementation(async (t: string, from: number) => {
        if (!raced) {
          raced = true;
          await cachingPubsub.publish(topic, { type: 'chunk', runId: 'r1', data: { c: '2' } });
        }
        return realListFromTo(t, from);
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

      const realListFromTo = cache.listFromTo.bind(cache);
      let raced = false;
      vi.spyOn(cache, 'listFromTo').mockImplementation(async (t: string, from: number) => {
        if (!raced) {
          raced = true;
          await cachingPubsub.publish(topic, { type: 'chunk', runId: 'r1', data: { c: '2' } });
        }
        return realListFromTo(t, from);
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

  describe('deprecated source', () => {
    it('accepts a source without copying its frames', async () => {
      const source = new EventEmitterPubSub();
      const pubsub = new CachingPubSub(innerPubsub, cache, { source });
      pubsub.__setSource(source);

      await source.publish('source-topic', { type: 'test', runId: 'run-1', data: {} });

      expect(await pubsub.getHistory('source-topic')).toEqual([]);
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
    it('delivers live without an index when the atomic append fails', async () => {
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

    it('numbers and caches frames through a cache that only has the default append', async () => {
      const topic = 'default-append-topic';

      // Third-party caches that never override `listPushIndexed` inherit the
      // base increment + listPush composition and must keep offset replay.
      class DefaultAppendCache extends InMemoryServerCache {
        override listPushIndexed(listKey: string, counterKey: string, value: Record<string, unknown>) {
          return MastraServerCache.prototype.listPushIndexed.call(this, listKey, counterKey, value);
        }
      }

      const cache = new DefaultAppendCache();
      const pubsub = new CachingPubSub(innerPubsub, cache);
      const callback = vi.fn();
      await pubsub.subscribe(topic, callback);
      await pubsub.publish(topic, { type: 'test', runId: 'run-1', data: {} });
      await pubsub.publish(topic, { type: 'test', runId: 'run-1', data: {} });

      expect(callback.mock.calls.map(call => call[0].index)).toEqual([0, 1]);
      expect(await cache.listLength(`pubsub:${topic}`)).toBe(2);
    });

    it('publishes through a single listPushIndexed cache call (no separate increment/listPush)', async () => {
      const topic = 'single-roundtrip-topic';
      const cache = new InMemoryServerCache();
      const indexedSpy = vi.spyOn(cache, 'listPushIndexed');
      const listPushSpy = vi.spyOn(cache, 'listPush');

      const pubsub = new CachingPubSub(innerPubsub, cache);
      const callback = vi.fn();
      await pubsub.subscribe(topic, callback);
      await pubsub.publish(topic, { type: 'test', runId: 'run-1', data: { a: 1 } });

      expect(indexedSpy).toHaveBeenCalledTimes(1);
      expect(indexedSpy.mock.calls[0]!.slice(0, 3)).toEqual([
        `pubsub:${topic}`,
        `pubsub:${topic}:counter`,
        expect.objectContaining({ type: 'test', runId: 'run-1', data: { a: 1 }, id: expect.any(String) }),
      ]);
      expect(listPushSpy).not.toHaveBeenCalled();
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
  });

  describe('steady-state dedup after replay', () => {
    it('delivers each index once after replay', async () => {
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
      await vi.waitFor(() => expect(callback).toHaveBeenCalledTimes(51)); // 1 cached + 50 live

      // Get the wrappedCb from the callbackMap
      const callbackMap = (cachingPubsub as any).callbackMap as Map<any, any>;
      const wrappedCb = callbackMap.get(callback);
      expect(wrappedCb).toBeDefined();

      // An index above the cursor is delivered (the log cannot supply the gap,
      // so the cursor adopts it), and repeating that index is dropped.
      callback.mockClear();
      const newEvent: Event = {
        id: 'brand-new',
        type: 'test',
        runId: 'run-1',
        data: {},
        createdAt: new Date(),
        index: 999,
      };
      await wrappedCb(newEvent);
      expect(callback).toHaveBeenCalledTimes(1);

      await wrappedCb(newEvent);
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

    it('delivers events published during the log read without duplication', async () => {
      const pullInner = new PullModePubSub();
      const pullCaching = new CachingPubSub(pullInner, cache);
      const topic = 'pull-bootstrap-race';

      // Pre-fill 2 events
      await pullCaching.publish(topic, { type: 'e0', runId: 'r', data: {} });
      await pullCaching.publish(topic, { type: 'e1', runId: 'r', data: {} });

      // Publish while the subscriber is reading the log
      const realListFromTo = cache.listFromTo.bind(cache);
      let raced = false;
      vi.spyOn(cache, 'listFromTo').mockImplementation(async (t: string, from: number, to?: number) => {
        if (!raced) {
          raced = true;
          await pullCaching.publish(topic, { type: 'e2', runId: 'r', data: {} });
        }
        return realListFromTo(t, from, to);
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
      await new Promise(resolve => setTimeout(resolve, 0));

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
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(received).toHaveLength(3);
      expect(received[2]).toEqual({ index: 1, attempt: 2 });
    });

    it('cleans up wrappedCb when the log read fails', async () => {
      const pullInner = new PullModePubSub();
      const pullCaching = new CachingPubSub(pullInner, cache);
      const topic = 'pull-bootstrap-fail';

      vi.spyOn(cache, 'listFromTo').mockRejectedValueOnce(new Error('cache down'));

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

    it('preserves ack and nack handles for live events delivered after the log', async () => {
      const pullInner = new PullModePubSub();
      const pullCaching = new CachingPubSub(pullInner, cache);
      const topic = 'pull-buffer-handles';

      await pullCaching.publish(topic, { type: 'e0', runId: 'r', data: {} });

      const realListFromTo = cache.listFromTo.bind(cache);
      let raced = false;
      const ackedByConsumer: number[] = [];
      vi.spyOn(cache, 'listFromTo').mockImplementation(async (t: string, from: number, to?: number) => {
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
        return realListFromTo(t, from, to);
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

  describe('run log and cursor', () => {
    const topic = 'agent.stream.run-1';
    const flush = () => new Promise(resolve => setTimeout(resolve, 20));

    /**
     * Mimics a stream backend that retains published frames and replays the
     * whole backlog on subscribe, then delivers live frames to attached
     * listeners. Frames are retained exactly as published, so a subscriber can
     * receive the same frame from both the transport and the log.
     */
    class RetainingPubSub extends PubSub {
      retained = new Map<string, Event[]>();
      listeners = new Map<string, Set<EventCallback>>();
      acked: Event[] = [];
      onLiveAttach?: () => void | Promise<void>;

      async publish(t: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
        const full: Event = { ...event, id: crypto.randomUUID(), createdAt: new Date() } as Event;
        const backlog = this.retained.get(t) ?? [];
        backlog.push(full);
        this.retained.set(t, backlog);
        for (const cb of this.listeners.get(t) ?? []) {
          await cb(full, async () => {
            this.acked.push(full);
          });
        }
      }

      async subscribe(t: string, cb: EventCallback): Promise<void> {
        const listeners = this.listeners.get(t) ?? new Set<EventCallback>();
        this.listeners.set(t, listeners);
        listeners.add(cb);
        for (const event of this.retained.get(t) ?? []) {
          await cb(event, async () => {
            this.acked.push(event);
          });
        }
        await this.onLiveAttach?.();
      }

      async unsubscribe(t: string, cb: EventCallback): Promise<void> {
        this.listeners.get(t)?.delete(cb);
      }

      async flush(): Promise<void> {}
    }

    /** Append a frame to the shared log and return it, index included. */
    const append = async (target: InMemoryServerCache, n: number, id = `frame-${n}`): Promise<Event> => {
      const frame = {
        type: 'chunk',
        runId: 'run-1',
        data: { n },
        id,
        createdAt: new Date(),
      } as Event;
      frame.index = await target.listPushIndexed(
        `pubsub:${topic}`,
        `pubsub:${topic}:counter`,
        frame as Omit<Event, 'id' | 'createdAt'>,
      );
      return frame;
    };

    it('delivers out-of-order frames from two workers in log order, exactly once', async () => {
      const inner = new RetainingPubSub();
      const shared = new InMemoryServerCache();
      const subscriber = new CachingPubSub(inner, shared);

      const received: number[] = [];
      await subscriber.subscribeFromOffset(topic, 0, event => {
        received.push(event.index!);
      });

      // Two workers claimed consecutive steps, so the log holds 0 then 1. The
      // transport can hand them over in either order; the cursor reads the gap
      // back from the log instead of dropping the late frame as a duplicate.
      const first = await append(shared, 0);
      const second = await append(shared, 1);
      await inner.publish(topic, second);
      await flush();

      expect(received).toEqual([0, 1]);

      await inner.publish(topic, first);
      await flush();

      expect(received).toEqual([0, 1]);
    });

    it('replays the log for a cold subscriber even when the transport replays nothing', async () => {
      const inner = new EventEmitterPubSub();
      const publisher = new CachingPubSub(inner, cache);
      for (let n = 0; n < 3; n++) {
        await publisher.publish(topic, { type: 'chunk', runId: 'run-1', data: { n } });
      }

      const subscriber = new CachingPubSub(inner, cache);
      const received: number[] = [];
      await subscriber.subscribeFromOffset(topic, 0, event => {
        received.push(event.index!);
      });

      expect(received).toEqual([0, 1, 2]);
    });

    it('serialises frames that arrive while the initial log read is in flight', async () => {
      const inner = new RetainingPubSub();
      const shared = new InMemoryServerCache();
      const frames: Event[] = [];
      for (let n = 0; n < 9; n++) frames.push(await append(shared, n));

      // The first read only returns the prefix, so the rest of the log is left
      // for the live frames to backfill from.
      const realListFromTo = shared.listFromTo.bind(shared);
      let historyStarted = false;
      let releaseHistory!: () => void;
      const historyHeld = new Promise<void>(resolve => (releaseHistory = resolve));
      (shared as any).listFromTo = async (key: string, from: number) => {
        const entries = (await realListFromTo(key, from)) as Event[];
        if (!historyStarted) {
          historyStarted = true;
          await historyHeld;
          return entries.filter(entry => (entry.index ?? 0) < 3);
        }
        return entries;
      };

      const seen: number[] = [];
      const gates = new Map<number, () => void>();
      let active = 0;
      let maxActive = 0;

      const subscriber = new CachingPubSub(inner, shared);
      const subscribed = subscriber.subscribeFromOffset(topic, 0, event => {
        const index = event.index!;
        seen.push(index);
        // Frames below 6 (the replayed prefix and the backfill up to the live
        // frame) are delivered immediately; 6 and up are held open so the test
        // can see whether a second chain starts alongside them.
        if (index < 6) return;
        active++;
        maxActive = Math.max(maxActive, active);
        return new Promise<void>(resolve => {
          gates.set(index, () => {
            active--;
            resolve();
          });
        });
      });

      await vi.waitFor(() => expect(historyStarted).toBe(true));

      // A frame arrives while the log is being read: it queues behind the read.
      void inner.publish(topic, frames[6]);
      releaseHistory();
      await vi.waitFor(() => expect(gates.has(6)).toBe(true));

      // The read is long gone, but this frame still has to queue behind the
      // in-flight one. Clearing the pending chain unconditionally would let a
      // second backfill read the same range alongside the first.
      void inner.publish(topic, frames[8]);
      await flush();
      expect(maxActive).toBe(1);

      gates.get(6)!();
      await vi.waitFor(() => expect(gates.has(7)).toBe(true));
      gates.get(7)!();
      await vi.waitFor(() => expect(gates.has(8)).toBe(true));
      gates.get(8)!();

      await subscribed;
      expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
      expect(maxActive).toBe(1);
    });

    it('honours the offset and acknowledges retained copies before it', async () => {
      const inner = new RetainingPubSub();
      const publisher = new CachingPubSub(inner, cache);
      for (let n = 0; n < 3; n++) {
        await publisher.publish(topic, { type: 'chunk', runId: 'run-1', data: { n } });
      }

      const subscriber = new CachingPubSub(inner, cache);
      const received: number[] = [];
      await subscriber.subscribeFromOffset(topic, 2, event => {
        received.push(event.index!);
      });
      await flush();

      // 0 and 1 arrive from the transport replay; both are before the cursor.
      expect(received).toEqual([2]);
      expect(inner.acked.map(event => event.index)).toEqual([0, 1]);
    });

    it('keeps the initial history read behind a backfill the transport started while subscribing', async () => {
      // A transport that replays retained frames without awaiting the callback
      // can start a backfill before `subscribe()` resolves. The history read
      // must queue behind it, not run alongside it.
      class UnawaitedReplayPubSub extends RetainingPubSub {
        override async subscribe(t: string, cb: EventCallback): Promise<void> {
          const listeners = this.listeners.get(t) ?? new Set<EventCallback>();
          this.listeners.set(t, listeners);
          listeners.add(cb);
          for (const event of this.retained.get(t) ?? []) {
            void cb(event, async () => {
              this.acked.push(event);
            });
          }
        }
      }

      const inner = new UnawaitedReplayPubSub();
      const shared = new InMemoryServerCache();
      const frames = [await append(shared, 0), await append(shared, 1), await append(shared, 2)];
      // Only the last frame is retained on the transport, so it opens a gap.
      inner.retained.set(topic, [frames[2]!]);

      const subscriber = new CachingPubSub(inner, shared);
      const received: number[] = [];
      let active = 0;
      let maxActive = 0;
      await subscriber.subscribeFromOffset(topic, 0, async event => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise(resolve => setTimeout(resolve, 5));
        received.push(event.index!);
        active--;
      });
      await vi.waitFor(() => expect(received.length).toBeGreaterThanOrEqual(3));
      await new Promise(resolve => setTimeout(resolve, 30));

      expect(received).toEqual([0, 1, 2]);
      expect(maxActive).toBe(1);

      // Same transport, but the retained frame is the next one, so it is
      // delivered directly rather than through a backfill. The history read
      // must still wait for that callback to finish.
      const nextInner = new UnawaitedReplayPubSub();
      const nextLog = new InMemoryServerCache();
      const nextFrames = [await append(nextLog, 0), await append(nextLog, 1), await append(nextLog, 2)];
      nextInner.retained.set(topic, [nextFrames[0]!]);

      const nextReceived: number[] = [];
      let nextActive = 0;
      let nextMaxActive = 0;
      await new CachingPubSub(nextInner, nextLog).subscribeFromOffset(topic, 0, async event => {
        nextActive++;
        nextMaxActive = Math.max(nextMaxActive, nextActive);
        await new Promise(resolve => setTimeout(resolve, 5));
        nextReceived.push(event.index!);
        nextActive--;
      });
      await vi.waitFor(() => expect(nextReceived.length).toBeGreaterThanOrEqual(3));
      await new Promise(resolve => setTimeout(resolve, 30));

      expect(nextReceived).toEqual([0, 1, 2]);
      expect(nextMaxActive).toBe(1);
    });

    it('resyncs when the log expired and a new run segment restarted numbering at 0', async () => {
      const inner = new RetainingPubSub();
      const shared = new InMemoryServerCache();
      const warn = vi.fn();
      const subscriber = new CachingPubSub(inner, shared, { logger: { warn } as unknown as IMastraLogger });

      const received: number[] = [];
      await subscriber.subscribeFromOffset(topic, 0, event => {
        received.push(event.index!);
      });

      // First segment runs to index 2, advancing the subscriber's cursor.
      const firstSegment = [await append(shared, 0), await append(shared, 1), await append(shared, 2)];
      for (const frame of firstSegment) await inner.publish(topic, frame);
      await flush();
      expect(received).toEqual([0, 1, 2]);

      // The log's TTL lapses, the run resumes, and numbering restarts at 0.
      await shared.delete(`pubsub:${topic}`);
      await shared.delete(`pubsub:${topic}:counter`);
      const secondSegment = [await append(shared, 0), await append(shared, 1)];
      for (const frame of secondSegment) await inner.publish(topic, frame);
      await flush();

      // Every new frame sits below the stale cursor, so dropping them as
      // duplicates would swallow the whole segment.
      expect(received).toEqual([0, 1, 2, 0, 1]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]![0]).toContain('restarted at 0');
    });

    it('still drops a late copy of frame 0 when the log did not restart', async () => {
      const inner = new RetainingPubSub();
      const shared = new InMemoryServerCache();
      const warn = vi.fn();
      const subscriber = new CachingPubSub(inner, shared, { logger: { warn } as unknown as IMastraLogger });

      const received: number[] = [];
      await subscriber.subscribeFromOffset(topic, 0, event => {
        received.push(event.index!);
      });

      const frames = [await append(shared, 0), await append(shared, 1)];
      for (const frame of frames) await inner.publish(topic, frame);
      await flush();
      expect(received).toEqual([0, 1]);

      // The counter is still ahead of the cursor, so this is a duplicate of
      // the log's real first frame, not a new segment.
      await inner.publish(topic, frames[0]!);
      await flush();

      expect(received).toEqual([0, 1]);
      expect(warn).not.toHaveBeenCalled();
      expect(inner.acked.map(event => event.index)).toEqual([0]);
    });

    it('delivers nothing for an offset past the end of a finished log', async () => {
      // The transport replays its whole backlog, frame 0 included, to the new subscriber.
      const inner = new RetainingPubSub();
      const shared = new InMemoryServerCache();
      const warn = vi.fn();
      const frames = [await append(shared, 0), await append(shared, 1), await append(shared, 2)];
      inner.retained.set(topic, frames);

      const subscriber = new CachingPubSub(inner, shared, { logger: { warn } as unknown as IMastraLogger });
      const received: number[] = [];
      await subscriber.subscribeFromOffset(topic, 5, event => {
        received.push(event.index!);
      });
      await flush();

      // Retained frame 0 is not a log restart: the log is intact, the offset is just past its end.
      expect(received).toEqual([]);
      expect(warn).not.toHaveBeenCalled();

      // Live frames below the offset stay skipped; delivery starts once the log reaches it.
      for (const n of [3, 4, 5, 6]) await inner.publish(topic, await append(shared, n));
      await flush();
      expect(received).toEqual([5, 6]);
      expect(warn).not.toHaveBeenCalled();
    });

    it('resyncs when a short log past the offset expires and a new segment restarts at 0', async () => {
      const inner = new RetainingPubSub();
      const shared = new InMemoryServerCache();
      const warn = vi.fn();
      inner.retained.set(topic, [await append(shared, 0)]);

      const subscriber = new CachingPubSub(inner, shared, { logger: { warn } as unknown as IMastraLogger });
      const received: number[] = [];
      await subscriber.subscribeFromOffset(topic, 5, event => {
        received.push(event.index!);
      });
      await flush();
      expect(received).toEqual([]);

      // The log expires and the resumed run numbers a new segment from 0. Its
      // counter matches the old log's length, so only frame 0's identity shows the restart.
      await shared.delete(`pubsub:${topic}`);
      await shared.delete(`pubsub:${topic}:counter`);
      for (const n of [0, 1]) await inner.publish(topic, await append(shared, n, `segment-2-${n}`));
      await flush();

      expect(received).toEqual([0, 1]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]![0]).toContain('restarted at 0');
    });

    it('resumes from an offset inside a short log without resyncing from the start', async () => {
      const inner = new RetainingPubSub();
      const shared = new InMemoryServerCache();
      const warn = vi.fn();
      const frames = [await append(shared, 0), await append(shared, 1)];
      inner.retained.set(topic, frames);

      const subscriber = new CachingPubSub(inner, shared, { logger: { warn } as unknown as IMastraLogger });
      const received: number[] = [];
      await subscriber.subscribeFromOffset(topic, 1, event => {
        received.push(event.index!);
      });
      await flush();

      expect(received).toEqual([1]);
      expect(warn).not.toHaveBeenCalled();
    });

    it('warns once when frames reaching an offset subscriber are not numbered', async () => {
      const inner = new RetainingPubSub();
      const shared = new InMemoryServerCache();
      const warn = vi.fn();
      const subscriber = new CachingPubSub(inner, shared, { logger: { warn } as unknown as IMastraLogger });
      const received: unknown[] = [];
      await subscriber.subscribeFromOffset(topic, 2, event => {
        received.push(event.data);
      });

      // Published straight on the transport, as a process without a shared log does.
      await inner.publish(topic, { type: 'chunk', runId: 'run-1', data: { n: 0 } });
      await inner.publish(topic, { type: 'chunk', runId: 'run-1', data: { n: 1 } });
      await flush();

      expect(received).toEqual([{ n: 0 }, { n: 1 }]);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]![0]).toContain('not numbered');
      expect(warn.mock.calls[0]![0]).toContain('RedisServerCache');
    });

    it('backfills a gap the transport skipped from the log', async () => {
      const inner = new RetainingPubSub();
      const shared = new InMemoryServerCache();
      const subscriber = new CachingPubSub(inner, shared);

      const received: number[] = [];
      await subscriber.subscribeFromOffset(topic, 0, event => {
        received.push(event.index!);
      });

      const frames = [await append(shared, 0), await append(shared, 1), await append(shared, 2)];
      // Only the last frame reaches the transport.
      await inner.publish(topic, frames[2]!);
      await flush();

      expect(received).toEqual([0, 1, 2]);
    });

    it('resumes live-only when the log cannot supply the missing range', async () => {
      const inner = new EventEmitterPubSub();
      const subscriber = new CachingPubSub(inner, cache);

      const received: number[] = [];
      await subscriber.subscribeFromOffset(topic, 0, event => {
        received.push(event.index!);
      });

      // No log history at all (cold cache), and the frame in hand is index 7.
      await inner.publish(topic, {
        type: 'chunk',
        runId: 'run-1',
        data: { n: 7 },
        index: 7,
      });
      await flush();

      expect(received).toEqual([7]);
    });

    it('does not drop a frame published between attach and the log read', async () => {
      const inner = new RetainingPubSub();
      const publisher = new CachingPubSub(inner, cache);
      inner.onLiveAttach = async () => {
        await publisher.publish(topic, { type: 'chunk', runId: 'run-1', data: { n: 0 } });
      };

      const received: number[] = [];
      await publisher.subscribeWithReplay(topic, event => {
        received.push(event.index!);
      });

      expect(received).toEqual([0]);
    });

    it('reads the log at an offset', async () => {
      const inner = new RetainingPubSub();
      const publisher = new CachingPubSub(inner, cache);
      for (let n = 0; n < 4; n++) {
        await publisher.publish(topic, { type: 'chunk', runId: 'run-1', data: { n } });
      }

      const history = await publisher.getHistory(topic, 2);
      expect(history.map(event => event.index)).toEqual([2, 3]);
      expect(history.map(event => event.data.n)).toEqual([2, 3]);
    });

    it('one append refreshes the list and counter together', async () => {
      const shared = new InMemoryServerCache();
      const pubsub = new CachingPubSub(new EventEmitterPubSub(), shared);

      await pubsub.publish(topic, { type: 'chunk', runId: 'run-1', data: { n: 0 } });

      // Both keys exist and the counter tracks the next index, so a subscriber
      // can tell the log's numbering from a restarted one.
      expect(await shared.listFromTo(`pubsub:${topic}`, 0)).toHaveLength(1);
      expect(await shared.get(`pubsub:${topic}:counter`)).toBe(1);
    });

    it('retains a durable run log for the run-log TTL on every append', async () => {
      const shared = new InMemoryServerCache();
      const append = vi.spyOn(shared, 'listPushIndexed');
      const pubsub = new CachingPubSub(new EventEmitterPubSub(), shared);

      await pubsub.publish('agent.stream.run-parked', { type: 'chunk', runId: 'run-parked', data: {} });
      await pubsub.publish('other-topic', { type: 'chunk', runId: 'run-1', data: {} });

      // A run parked on an approval outlives the cache default; its log has to
      // as well. Other topics keep the cache's own TTL.
      expect(append.mock.calls.map(call => call[3])).toEqual([RUN_LOG_TTL_MS, undefined]);
    });

    it('keeps a parked run observable past the cache default retention', async () => {
      const runTopic = 'agent.stream.run-parked';
      const shared = new InMemoryServerCache({ ttlMs: 20 });
      const pubsub = new CachingPubSub(new EventEmitterPubSub(), shared);
      await pubsub.publish(runTopic, { type: 'chunk', runId: 'run-parked', data: { n: 0 } });

      // Real timers: the in-memory cache's TTL clock is not faked by vitest.
      await new Promise(resolve => setTimeout(resolve, 60));

      expect(await shared.listFromTo(`pubsub:${runTopic}`, 0)).toHaveLength(1);
      expect(await shared.get(`pubsub:${runTopic}:counter`)).toBe(1);
    });
  });
});
