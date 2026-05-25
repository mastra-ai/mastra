import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';

/**
 * Integration tests for resumable streams functionality.
 *
 * These tests verify that:
 * 1. Events are cached when publishing
 * 2. Late subscribers receive all cached events via replay
 * 3. Multiple subscribers each get complete history
 * 4. Deduplication works at the replay/live boundary
 */
describe('Resumable Streams Integration', () => {
  let cache: InMemoryServerCache;
  let innerPubsub: EventEmitterPubSub;
  let cachingPubsub: CachingPubSub;

  beforeEach(() => {
    cache = new InMemoryServerCache();
    innerPubsub = new EventEmitterPubSub();
    cachingPubsub = new CachingPubSub(innerPubsub, cache);
  });

  describe('Late subscriber replay', () => {
    it('should replay all events to a late subscriber', async () => {
      const runId = 'test-run-1';
      const topic = `${AGENT_STREAM_TOPIC}.${runId}`;
      const receivedEvents: Event[] = [];

      // 1. Publish some events before any subscriber
      await cachingPubsub.publish(topic, {
        type: AgentStreamEventTypes.CHUNK,
        runId,
        data: { chunk: 'Hello ' },
      });
      await cachingPubsub.publish(topic, {
        type: AgentStreamEventTypes.CHUNK,
        runId,
        data: { chunk: 'World!' },
      });
      await cachingPubsub.publish(topic, {
        type: AgentStreamEventTypes.FINISH,
        runId,
        data: { text: 'Hello World!' },
      });

      // Wait for cache writes
      await new Promise(resolve => setTimeout(resolve, 20));

      // 2. Late subscriber joins and should receive all events
      await cachingPubsub.subscribeWithReplay(topic, event => {
        receivedEvents.push(event);
      });

      // 3. Verify all events were received
      expect(receivedEvents).toHaveLength(3);
      expect(receivedEvents[0].type).toBe(AgentStreamEventTypes.CHUNK);
      expect(receivedEvents[0].data).toEqual({ chunk: 'Hello ' });
      expect(receivedEvents[1].type).toBe(AgentStreamEventTypes.CHUNK);
      expect(receivedEvents[1].data).toEqual({ chunk: 'World!' });
      expect(receivedEvents[2].type).toBe(AgentStreamEventTypes.FINISH);
    });

    it('should receive both cached and live events', async () => {
      const runId = 'test-run-2';
      const topic = `${AGENT_STREAM_TOPIC}.${runId}`;
      const receivedEvents: Event[] = [];

      // 1. Publish cached events
      await cachingPubsub.publish(topic, {
        type: AgentStreamEventTypes.CHUNK,
        runId,
        data: { chunk: 'Cached ' },
      });
      await new Promise(resolve => setTimeout(resolve, 20));

      // 2. Subscribe with replay
      await cachingPubsub.subscribeWithReplay(topic, event => {
        receivedEvents.push(event);
      });

      // 3. Publish live events after subscription
      await cachingPubsub.publish(topic, {
        type: AgentStreamEventTypes.CHUNK,
        runId,
        data: { chunk: 'Live!' },
      });

      // 4. Verify both cached and live events received
      expect(receivedEvents).toHaveLength(2);
      expect(receivedEvents[0].data).toEqual({ chunk: 'Cached ' });
      expect(receivedEvents[1].data).toEqual({ chunk: 'Live!' });
    });
  });

  describe('Multiple subscribers', () => {
    it('should give each subscriber complete history', async () => {
      const runId = 'test-run-3';
      const topic = `${AGENT_STREAM_TOPIC}.${runId}`;
      const subscriber1Events: Event[] = [];
      const subscriber2Events: Event[] = [];

      // 1. Publish events
      await cachingPubsub.publish(topic, {
        type: AgentStreamEventTypes.CHUNK,
        runId,
        data: { chunk: 'Event 1' },
      });
      await cachingPubsub.publish(topic, {
        type: AgentStreamEventTypes.CHUNK,
        runId,
        data: { chunk: 'Event 2' },
      });
      await new Promise(resolve => setTimeout(resolve, 20));

      // 2. First subscriber joins
      await cachingPubsub.subscribeWithReplay(topic, event => {
        subscriber1Events.push(event);
      });

      // 3. Publish more events
      await cachingPubsub.publish(topic, {
        type: AgentStreamEventTypes.CHUNK,
        runId,
        data: { chunk: 'Event 3' },
      });
      await new Promise(resolve => setTimeout(resolve, 20));

      // 4. Second subscriber joins (should get all 3 events)
      await cachingPubsub.subscribeWithReplay(topic, event => {
        subscriber2Events.push(event);
      });

      // 5. Verify both subscribers got correct events
      expect(subscriber1Events).toHaveLength(3);
      expect(subscriber2Events).toHaveLength(3);

      // Both should have the same events
      expect(subscriber1Events.map(e => e.data)).toEqual(subscriber2Events.map(e => e.data));
    });
  });

  describe('Disconnect/Reconnect scenario', () => {
    it('should allow reconnection without missing events', async () => {
      const runId = 'test-run-4';
      const topic = `${AGENT_STREAM_TOPIC}.${runId}`;
      const firstConnectionEvents: Event[] = [];
      const reconnectionEvents: Event[] = [];

      // 1. First connection subscribes
      const firstCallback = vi.fn((event: Event) => {
        firstConnectionEvents.push(event);
      });
      await cachingPubsub.subscribeWithReplay(topic, firstCallback);

      // 2. Receive some events
      await cachingPubsub.publish(topic, {
        type: AgentStreamEventTypes.CHUNK,
        runId,
        data: { chunk: 'Before disconnect' },
      });

      expect(firstConnectionEvents).toHaveLength(1);

      // 3. Simulate disconnect (unsubscribe)
      await cachingPubsub.unsubscribe(topic, firstCallback);

      // 4. More events happen while disconnected
      await cachingPubsub.publish(topic, {
        type: AgentStreamEventTypes.CHUNK,
        runId,
        data: { chunk: 'During disconnect' },
      });
      await cachingPubsub.publish(topic, {
        type: AgentStreamEventTypes.FINISH,
        runId,
        data: { text: 'Complete' },
      });
      await new Promise(resolve => setTimeout(resolve, 20));

      // 5. Reconnect with replay - should get ALL events
      await cachingPubsub.subscribeWithReplay(topic, event => {
        reconnectionEvents.push(event);
      });

      // 6. Verify reconnection received all events (including missed ones)
      expect(reconnectionEvents).toHaveLength(3);
      expect(reconnectionEvents[0].data).toEqual({ chunk: 'Before disconnect' });
      expect(reconnectionEvents[1].data).toEqual({ chunk: 'During disconnect' });
      expect(reconnectionEvents[2].data).toEqual({ text: 'Complete' });
    });
  });

  describe('Topic isolation', () => {
    it('should keep events separate per run', async () => {
      const run1Topic = `${AGENT_STREAM_TOPIC}.run-1`;
      const run2Topic = `${AGENT_STREAM_TOPIC}.run-2`;
      const run1Events: Event[] = [];
      const run2Events: Event[] = [];

      // Publish to both runs
      await cachingPubsub.publish(run1Topic, {
        type: AgentStreamEventTypes.CHUNK,
        runId: 'run-1',
        data: { chunk: 'Run 1 event' },
      });
      await cachingPubsub.publish(run2Topic, {
        type: AgentStreamEventTypes.CHUNK,
        runId: 'run-2',
        data: { chunk: 'Run 2 event' },
      });
      await new Promise(resolve => setTimeout(resolve, 20));

      // Subscribe to each run separately
      await cachingPubsub.subscribeWithReplay(run1Topic, event => {
        run1Events.push(event);
      });
      await cachingPubsub.subscribeWithReplay(run2Topic, event => {
        run2Events.push(event);
      });

      // Verify isolation
      expect(run1Events).toHaveLength(1);
      expect(run1Events[0].data).toEqual({ chunk: 'Run 1 event' });

      expect(run2Events).toHaveLength(1);
      expect(run2Events[0].data).toEqual({ chunk: 'Run 2 event' });
    });
  });

  describe('Cache cleanup', () => {
    it('should clear topic cache when requested', async () => {
      const runId = 'test-run-cleanup';
      const topic = `${AGENT_STREAM_TOPIC}.${runId}`;

      // Publish events
      await cachingPubsub.publish(topic, {
        type: AgentStreamEventTypes.CHUNK,
        runId,
        data: { chunk: 'Event' },
      });
      await new Promise(resolve => setTimeout(resolve, 20));

      // Verify events are cached
      let history = await cachingPubsub.getHistory(topic);
      expect(history).toHaveLength(1);

      // Clear the topic
      await cachingPubsub.clearTopic(topic);

      // Verify cache is empty
      history = await cachingPubsub.getHistory(topic);
      expect(history).toHaveLength(0);
    });
  });
});
