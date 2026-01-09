import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IPCPubSub } from '../events/ipc-pubsub';
import type { Event } from '../events/types';

describe('IPCPubSub', () => {
  let pubsub: IPCPubSub;

  beforeEach(() => {
    pubsub = new IPCPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  describe('local subscriptions', () => {
    it('should handle local publish/subscribe', async () => {
      const callback = vi.fn();
      const testEvent = {
        type: 'test-event',
        data: { message: 'hello' },
        runId: 'test-run-123',
      };

      await pubsub.subscribe('test-topic', callback);
      await pubsub.publish('test-topic', testEvent);

      expect(callback).toHaveBeenCalledTimes(1);
      const receivedEvent = callback.mock.calls[0]![0] as Event;
      expect(receivedEvent.type).toBe('test-event');
      expect(receivedEvent.data).toEqual({ message: 'hello' });
      expect(receivedEvent.runId).toBe('test-run-123');
      expect(receivedEvent.id).toBeDefined();
      expect(receivedEvent.createdAt).toBeInstanceOf(Date);
    });

    it('should support multiple subscribers on same topic', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      await pubsub.subscribe('multi-topic', callback1);
      await pubsub.subscribe('multi-topic', callback2);

      await pubsub.publish('multi-topic', {
        type: 'multi-event',
        data: {},
        runId: 'run-1',
      });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe correctly', async () => {
      const callback = vi.fn();

      await pubsub.subscribe('unsub-topic', callback);
      await pubsub.publish('unsub-topic', {
        type: 'event-1',
        data: {},
        runId: 'run-1',
      });

      expect(callback).toHaveBeenCalledTimes(1);

      await pubsub.unsubscribe('unsub-topic', callback);
      await pubsub.publish('unsub-topic', {
        type: 'event-2',
        data: {},
        runId: 'run-2',
      });

      // Should still be 1 after unsubscribing
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not call callbacks for different topics', async () => {
      const callback = vi.fn();

      await pubsub.subscribe('topic-a', callback);
      await pubsub.publish('topic-b', {
        type: 'event',
        data: {},
        runId: 'run-1',
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('worker mode detection', () => {
    it('should correctly detect worker mode based on process.send', () => {
      // isInWorkerMode should match whether process.send is defined
      // (vitest runs tests in a forked process, so process.send may be defined)
      const expectedWorkerMode = typeof process.send === 'function';
      expect(pubsub.isInWorkerMode).toBe(expectedWorkerMode);
    });
  });

  describe('child count', () => {
    it('should return 0 when no children attached', () => {
      expect(pubsub.childCount).toBe(0);
    });
  });

  describe('flush', () => {
    it('should be a no-op', async () => {
      // Just verify it doesn't throw
      await expect(pubsub.flush()).resolves.toBeUndefined();
    });
  });

  describe('close', () => {
    it('should clear all handlers', async () => {
      const callback = vi.fn();
      await pubsub.subscribe('test', callback);
      await pubsub.close();

      // After close, publishing should not call the callback
      // (handlers are cleared, but publish still runs - it just has no effect)
      await pubsub.publish('test', {
        type: 'event',
        data: {},
        runId: 'run-1',
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
