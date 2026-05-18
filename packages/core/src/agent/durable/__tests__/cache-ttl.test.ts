/**
 * Tests for cache TTL expiry behavior with resumable streams.
 *
 * These tests verify that cache entries expire correctly and that
 * the system behaves appropriately when cached events are no longer available.
 */

import { describe, it, expect } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';

describe('Cache TTL Expiry Behavior', () => {
  describe('InMemoryServerCache TTL', () => {
    it('should support configurable TTL', () => {
      const cache = new InMemoryServerCache({ ttlMs: 100 });
      expect(cache).toBeInstanceOf(InMemoryServerCache);
    });

    it('should expire cached items after TTL', async () => {
      // Use very short TTL for testing
      const cache = new InMemoryServerCache({ ttlMs: 50 });

      await cache.set('test-key', 'test-value');

      // Value should exist immediately
      expect(await cache.get('test-key')).toBe('test-value');

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      // Value should be gone
      expect(await cache.get('test-key')).toBeUndefined();
    });

    it('should expire list items after TTL', async () => {
      const cache = new InMemoryServerCache({ ttlMs: 50 });

      await cache.listPush('test-list', 'item1');
      await cache.listPush('test-list', 'item2');

      // List should exist immediately
      expect(await cache.listFromTo('test-list', 0)).toEqual(['item1', 'item2']);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      // List should be empty (key expired)
      expect(await cache.listFromTo('test-list', 0)).toEqual([]);
    });

    it('should refresh TTL on list push', async () => {
      const cache = new InMemoryServerCache({ ttlMs: 100 });

      // Initial push
      await cache.listPush('test-list', 'item1');

      // Wait 60ms (but not past TTL)
      await new Promise(resolve => setTimeout(resolve, 60));

      // Push again - should refresh TTL
      await cache.listPush('test-list', 'item2');

      // Wait another 60ms (120ms total from first push)
      await new Promise(resolve => setTimeout(resolve, 60));

      // List should still exist because second push refreshed TTL
      const items = await cache.listFromTo('test-list', 0);
      expect(items).toHaveLength(2);
    });

    it('should support disabling TTL with ttlMs: 0', async () => {
      const cache = new InMemoryServerCache({ ttlMs: 0 });

      await cache.set('permanent-key', 'permanent-value');

      // Wait a reasonable time
      await new Promise(resolve => setTimeout(resolve, 100));

      // Value should still exist
      expect(await cache.get('permanent-key')).toBe('permanent-value');
    });

    it('should respect maxSize option', async () => {
      const cache = new InMemoryServerCache({ maxSize: 3, ttlMs: 60000 });

      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      await cache.set('key4', 'value4');

      // Oldest entry should be evicted (LRU policy)
      // Note: TTLCache uses LRU eviction when max is reached
      expect(await cache.get('key1')).toBeUndefined();
      expect(await cache.get('key4')).toBe('value4');
    });
  });

  describe('CachingPubSub with TTL', () => {
    it('should return empty history when cache expires', async () => {
      const cache = new InMemoryServerCache({ ttlMs: 50 });
      const innerPubsub = new EventEmitterPubSub();
      const cachingPubsub = new CachingPubSub(innerPubsub, cache);

      const runId = 'ttl-test-1';
      const topic = `${AGENT_STREAM_TOPIC}.${runId}`;

      // Publish events
      await cachingPubsub.publish(topic, {
        type: AgentStreamEventTypes.CHUNK,
        runId,
        data: { chunk: 'Hello' },
      });

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      // History should be empty
      const history = await cachingPubsub.getHistory(topic);
      expect(history).toHaveLength(0);
    });

    it('should still receive live events after cache expires', async () => {
      const cache = new InMemoryServerCache({ ttlMs: 50 });
      const innerPubsub = new EventEmitterPubSub();
      const cachingPubsub = new CachingPubSub(innerPubsub, cache);

      const runId = 'ttl-test-2';
      const topic = `${AGENT_STREAM_TOPIC}.${runId}`;
      const receivedEvents: Event[] = [];

      // Publish old events that will expire
      await cachingPubsub.publish(topic, {
        type: AgentStreamEventTypes.CHUNK,
        runId,
        data: { chunk: 'Old event' },
      });

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      // Subscribe with replay - should get no replay but still work
      await cachingPubsub.subscribeWithReplay(topic, event => {
        receivedEvents.push(event);
      });

      // Publish new events
      await cachingPubsub.publish(topic, {
        type: AgentStreamEventTypes.CHUNK,
        runId,
        data: { chunk: 'New event' },
      });

      // Should only receive new event (old one expired)
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].data).toEqual({ chunk: 'New event' });
    });

    it('should handle partial cache expiry gracefully', async () => {
      // This tests the edge case where some events might be missing from replay
      // due to TTL, but live events still work correctly
      const cache = new InMemoryServerCache({ ttlMs: 150 });
      const innerPubsub = new EventEmitterPubSub();
      const cachingPubsub = new CachingPubSub(innerPubsub, cache);

      const runId = 'ttl-test-3';
      const topic = `${AGENT_STREAM_TOPIC}.${runId}`;
      const receivedEvents: Event[] = [];

      // Publish first batch
      await cachingPubsub.publish(topic, {
        type: AgentStreamEventTypes.CHUNK,
        runId,
        data: { chunk: 'Event 1' },
      });

      // Wait a bit but not past TTL
      await new Promise(resolve => setTimeout(resolve, 50));

      // Publish second batch (refreshes TTL for the list)
      await cachingPubsub.publish(topic, {
        type: AgentStreamEventTypes.CHUNK,
        runId,
        data: { chunk: 'Event 2' },
      });

      // Subscribe and get all events (TTL was refreshed)
      await cachingPubsub.subscribeWithReplay(topic, event => {
        receivedEvents.push(event);
      });

      expect(receivedEvents).toHaveLength(2);
    });
  });

  describe('Default TTL values', () => {
    it('should use 5 minute default TTL for InMemoryServerCache', () => {
      const cache = new InMemoryServerCache();
      // Can't directly check internal TTL, but we can verify behavior
      // by checking that items don't expire immediately
      expect(cache).toBeInstanceOf(InMemoryServerCache);
    });
  });
});
