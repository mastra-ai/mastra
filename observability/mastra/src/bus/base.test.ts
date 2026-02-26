/**
 * Unit tests for BaseObservabilityEventBus
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseObservabilityEventBus } from './base';

describe('BaseObservabilityEventBus', () => {
  let bus: BaseObservabilityEventBus<string>;

  beforeEach(() => {
    bus = new BaseObservabilityEventBus<string>();
  });

  afterEach(async () => {
    await bus.shutdown();
  });

  describe('emit and subscribe', () => {
    it('should deliver events to subscribers immediately on emit', () => {
      const handler = vi.fn();
      bus.subscribe(handler);

      bus.emit('event-1');
      bus.emit('event-2');

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith('event-1');
      expect(handler).toHaveBeenCalledWith('event-2');
    });

    it('should deliver events to multiple subscribers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bus.subscribe(handler1);
      bus.subscribe(handler2);

      bus.emit('event-1');

      expect(handler1).toHaveBeenCalledWith('event-1');
      expect(handler2).toHaveBeenCalledWith('event-1');
    });

    it('should not deliver events after unsubscribe', () => {
      const handler = vi.fn();
      const unsubscribe = bus.subscribe(handler);

      bus.emit('event-1');
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      bus.emit('event-2');
      // Still only called once
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should continue delivering to other handlers if one throws', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('handler error');
      });
      const goodHandler = vi.fn();

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      bus.subscribe(errorHandler);
      bus.subscribe(goodHandler);

      bus.emit('event-1');

      expect(errorHandler).toHaveBeenCalledWith('event-1');
      expect(goodHandler).toHaveBeenCalledWith('event-1');

      consoleSpy.mockRestore();
    });

    it('should catch rejections from async handlers', async () => {
      const rejectHandler = vi.fn(async () => {
        throw new Error('async handler error');
      });
      const goodHandler = vi.fn();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      bus.subscribe(rejectHandler);
      bus.subscribe(goodHandler);

      bus.emit('event-1');

      expect(rejectHandler).toHaveBeenCalledWith('event-1');
      expect(goodHandler).toHaveBeenCalledWith('event-1');

      // Give the async rejection handler time to fire
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('flush', () => {
    it('should resolve immediately when no async handlers are pending', async () => {
      const handler = vi.fn();
      bus.subscribe(handler);

      bus.emit('event-1');
      expect(handler).toHaveBeenCalledTimes(1);

      // flush should resolve without delivering anything extra
      await bus.flush();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should await pending async subscriber promises', async () => {
      let handlerDone = false;

      bus.subscribe(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        handlerDone = true;
      });

      bus.emit('event-1');
      expect(handlerDone).toBe(false);

      await bus.flush();
      expect(handlerDone).toBe(true);
    });

    it('should await multiple concurrent async subscriber promises', async () => {
      const order: string[] = [];

      bus.subscribe(async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        order.push('handler-1');
      });

      bus.subscribe(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        order.push('handler-2');
      });

      bus.emit('event-1');
      expect(order).toHaveLength(0);

      await bus.flush();
      expect(order).toContain('handler-1');
      expect(order).toContain('handler-2');
    });

    it('should handle rejected async subscriber promises gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      let goodHandlerDone = false;

      bus.subscribe(async () => {
        throw new Error('subscriber error');
      });

      bus.subscribe(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        goodHandlerDone = true;
      });

      bus.emit('event-1');

      await bus.flush();
      expect(goodHandlerDone).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should self-clean resolved promises from the pending set', async () => {
      bus.subscribe(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      bus.emit('event-1');
      await bus.flush();

      // Second flush should resolve immediately (no pending promises)
      const start = Date.now();
      await bus.flush();
      expect(Date.now() - start).toBeLessThan(10);
    });
  });

  describe('shutdown', () => {
    it('should flush then clear subscribers on shutdown', async () => {
      let handlerDone = false;
      bus.subscribe(async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        handlerDone = true;
      });

      bus.emit('event-1');
      await bus.shutdown();

      // Handler should have completed during shutdown flush
      expect(handlerDone).toBe(true);

      // Subscribers should be cleared
      const handler = vi.fn();
      bus.subscribe(handler);
      // The old handler is gone, only new one should work
    });

    it('should clear subscribers on shutdown', async () => {
      const handler = vi.fn();
      bus.subscribe(handler);

      await bus.shutdown();

      bus.emit('event-after-shutdown');
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
