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
    it('should deliver events to subscribers on flush', async () => {
      const handler = vi.fn();
      bus.subscribe(handler);

      bus.emit('event-1');
      bus.emit('event-2');

      // Events are buffered, not delivered yet
      expect(handler).not.toHaveBeenCalled();

      await bus.flush();

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith('event-1');
      expect(handler).toHaveBeenCalledWith('event-2');
    });

    it('should deliver events to multiple subscribers', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bus.subscribe(handler1);
      bus.subscribe(handler2);

      bus.emit('event-1');
      await bus.flush();

      expect(handler1).toHaveBeenCalledWith('event-1');
      expect(handler2).toHaveBeenCalledWith('event-1');
    });

    it('should not deliver events after unsubscribe', async () => {
      const handler = vi.fn();
      const unsubscribe = bus.subscribe(handler);

      bus.emit('event-1');
      await bus.flush();
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      bus.emit('event-2');
      await bus.flush();
      // Still only called once
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle empty flush gracefully', async () => {
      const handler = vi.fn();
      bus.subscribe(handler);

      await bus.flush();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('buffering', () => {
    it('should auto-flush when buffer is full', async () => {
      const smallBus = new BaseObservabilityEventBus<string>({ bufferSize: 2 });
      const handler = vi.fn();
      smallBus.subscribe(handler);

      smallBus.emit('event-1');
      // Not flushed yet (buffer size = 2, only 1 event)
      expect(handler).not.toHaveBeenCalled();

      smallBus.emit('event-2');
      // Buffer full, auto-flush triggered (async)
      // Give it a tick to process
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledTimes(2);

      await smallBus.shutdown();
    });

    it('should use default buffer size of 100', async () => {
      const handler = vi.fn();
      bus.subscribe(handler);

      // Emit 99 events (under buffer limit)
      for (let i = 0; i < 99; i++) {
        bus.emit(`event-${i}`);
      }

      // Not auto-flushed yet
      expect(handler).not.toHaveBeenCalled();

      // Emit 100th event should trigger auto-flush
      bus.emit('event-99');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledTimes(100);
    });
  });

  describe('flush interval', () => {
    it('should auto-flush on interval', async () => {
      const intervalBus = new BaseObservabilityEventBus<string>({
        flushIntervalMs: 50,
      });
      const handler = vi.fn();
      intervalBus.subscribe(handler);

      intervalBus.emit('event-1');

      // Wait for the interval to trigger
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(handler).toHaveBeenCalledWith('event-1');

      await intervalBus.shutdown();
    });
  });

  describe('error handling', () => {
    it('should continue delivering to other handlers if one throws', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('handler error');
      });
      const goodHandler = vi.fn();

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      bus.subscribe(errorHandler);
      bus.subscribe(goodHandler);

      bus.emit('event-1');
      await bus.flush();

      expect(errorHandler).toHaveBeenCalledWith('event-1');
      expect(goodHandler).toHaveBeenCalledWith('event-1');

      consoleSpy.mockRestore();
    });

    it('should continue delivering to other handlers if one rejects', async () => {
      const rejectHandler = vi.fn(async () => {
        throw new Error('async handler error');
      });
      const goodHandler = vi.fn();

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      bus.subscribe(rejectHandler);
      bus.subscribe(goodHandler);

      bus.emit('event-1');
      await bus.flush();

      expect(rejectHandler).toHaveBeenCalledWith('event-1');
      expect(goodHandler).toHaveBeenCalledWith('event-1');

      consoleSpy.mockRestore();
    });
  });

  describe('shutdown', () => {
    it('should flush remaining events on shutdown', async () => {
      const handler = vi.fn();
      bus.subscribe(handler);

      bus.emit('event-1');
      bus.emit('event-2');

      await bus.shutdown();

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should clear subscribers on shutdown', async () => {
      const handler = vi.fn();
      bus.subscribe(handler);

      await bus.shutdown();

      // Create a new bus since the old one is shut down
      const newBus = new BaseObservabilityEventBus<string>();
      // Old bus should have no subscribers
      bus.emit('event-after-shutdown');
      await bus.flush();
      expect(handler).not.toHaveBeenCalled();

      await newBus.shutdown();
    });

    it('should clear flush interval on shutdown', async () => {
      const intervalBus = new BaseObservabilityEventBus<string>({
        flushIntervalMs: 50,
      });
      const handler = vi.fn();
      intervalBus.subscribe(handler);

      await intervalBus.shutdown();

      // After shutdown, interval should be cleared - no more auto-flushes
      intervalBus.emit('event-after-shutdown');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Handler should not receive this event (subscribers cleared)
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
