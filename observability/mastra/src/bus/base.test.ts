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
    it('should be a no-op (events are dispatched immediately)', async () => {
      const handler = vi.fn();
      bus.subscribe(handler);

      bus.emit('event-1');
      expect(handler).toHaveBeenCalledTimes(1);

      // flush should resolve without delivering anything extra
      await bus.flush();
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('shutdown', () => {
    it('should clear subscribers on shutdown', async () => {
      const handler = vi.fn();
      bus.subscribe(handler);

      await bus.shutdown();

      bus.emit('event-after-shutdown');
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
