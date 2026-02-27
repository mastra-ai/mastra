/**
 * Unit tests for ObservabilityBus - type-based event routing to exporters.
 */

import { SpanType, TracingEventType } from '@mastra/core/observability';
import type {
  ObservabilityExporter,
  ObservabilityBridge,
  TracingEvent,
  LogEvent,
  MetricEvent,
  ScoreEvent,
  FeedbackEvent,
  AnyExportedSpan,
} from '@mastra/core/observability';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ObservabilityBus } from './observability-bus';

// ============================================================================
// Test Helpers
// ============================================================================

function createMockExporter(overrides: Partial<ObservabilityExporter> = {}): ObservabilityExporter {
  return {
    name: 'mock-exporter',
    exportTracingEvent: vi.fn().mockResolvedValue(undefined),
    flush: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockSpan(overrides: Partial<AnyExportedSpan> = {}): AnyExportedSpan {
  return {
    id: 'span-1',
    traceId: 'trace-1',
    name: 'test-span',
    type: SpanType.AGENT_RUN,
    isRootSpan: true,
    isEvent: false,
    startTime: new Date(),
    ...overrides,
  };
}

function createTracingEvent(type: TracingEventType = TracingEventType.SPAN_ENDED): TracingEvent {
  return { type, exportedSpan: createMockSpan() };
}

function createLogEvent(): LogEvent {
  return {
    type: 'log',
    log: {
      timestamp: new Date(),
      level: 'info',
      message: 'test log message',
      data: { key: 'value' },
    },
  };
}

function createMetricEvent(): MetricEvent {
  return {
    type: 'metric',
    metric: {
      timestamp: new Date(),
      name: 'mastra_test_counter',
      metricType: 'counter',
      value: 1,
      labels: { env: 'test' },
    },
  };
}

function createScoreEvent(): ScoreEvent {
  return {
    type: 'score',
    score: {
      timestamp: new Date(),
      traceId: 'trace-1',
      scorerName: 'relevance',
      score: 0.85,
      reason: 'Relevant response',
    },
  };
}

function createFeedbackEvent(): FeedbackEvent {
  return {
    type: 'feedback',
    feedback: {
      timestamp: new Date(),
      traceId: 'trace-1',
      source: 'user',
      feedbackType: 'thumbs',
      value: 1,
    },
  };
}

function createMockBridge(overrides: Partial<ObservabilityBridge> = {}): ObservabilityBridge {
  return {
    name: 'mock-bridge',
    exportTracingEvent: vi.fn().mockResolvedValue(undefined),
    createSpan: vi.fn().mockReturnValue(undefined),
    flush: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('ObservabilityBus', () => {
  let bus: ObservabilityBus;

  beforeEach(() => {
    bus = new ObservabilityBus();
  });

  afterEach(async () => {
    await bus.shutdown();
  });

  describe('exporter registration', () => {
    it('should register and return exporters', () => {
      const exporter1 = createMockExporter({ name: 'exporter-1' });
      const exporter2 = createMockExporter({ name: 'exporter-2' });

      bus.registerExporter(exporter1);
      bus.registerExporter(exporter2);

      const exporters = bus.getExporters();
      expect(exporters).toHaveLength(2);
      expect(exporters[0]!.name).toBe('exporter-1');
      expect(exporters[1]!.name).toBe('exporter-2');
    });

    it('should unregister exporters', () => {
      const exporter = createMockExporter({ name: 'exporter-1' });
      bus.registerExporter(exporter);

      const removed = bus.unregisterExporter(exporter);
      expect(removed).toBe(true);
      expect(bus.getExporters()).toHaveLength(0);
    });

    it('should return false when unregistering non-existent exporter', () => {
      const exporter = createMockExporter();
      const removed = bus.unregisterExporter(exporter);
      expect(removed).toBe(false);
    });

    it('should return a snapshot of exporters', () => {
      const exporter = createMockExporter();
      bus.registerExporter(exporter);

      const exporters = bus.getExporters();
      // Modifying the returned array should not affect the bus
      (exporters as ObservabilityExporter[]).push(createMockExporter());
      expect(bus.getExporters()).toHaveLength(1);
    });
  });

  describe('tracing event routing', () => {
    it('should route SPAN_STARTED to onTracingEvent', () => {
      const onTracingEvent = vi.fn();
      const exporter = createMockExporter({ onTracingEvent });
      bus.registerExporter(exporter);

      const event = createTracingEvent(TracingEventType.SPAN_STARTED);
      bus.emit(event);

      expect(onTracingEvent).toHaveBeenCalledWith(event);
    });

    it('should route SPAN_UPDATED to onTracingEvent', () => {
      const onTracingEvent = vi.fn();
      const exporter = createMockExporter({ onTracingEvent });
      bus.registerExporter(exporter);

      const event = createTracingEvent(TracingEventType.SPAN_UPDATED);
      bus.emit(event);

      expect(onTracingEvent).toHaveBeenCalledWith(event);
    });

    it('should route SPAN_ENDED to onTracingEvent', () => {
      const onTracingEvent = vi.fn();
      const exporter = createMockExporter({ onTracingEvent });
      bus.registerExporter(exporter);

      const event = createTracingEvent(TracingEventType.SPAN_ENDED);
      bus.emit(event);

      expect(onTracingEvent).toHaveBeenCalledWith(event);
    });

    it('should not fail when exporter has no onTracingEvent handler', () => {
      const exporter = createMockExporter({ onTracingEvent: undefined });
      bus.registerExporter(exporter);

      // Should not throw
      bus.emit(createTracingEvent());
    });
  });

  describe('log event routing', () => {
    it('should route log events to onLogEvent', () => {
      const onLogEvent = vi.fn();
      const exporter = createMockExporter({ onLogEvent });
      bus.registerExporter(exporter);

      const event = createLogEvent();
      bus.emit(event);

      expect(onLogEvent).toHaveBeenCalledWith(event);
    });

    it('should not fail when exporter has no onLogEvent handler', () => {
      const exporter = createMockExporter({ onLogEvent: undefined });
      bus.registerExporter(exporter);

      bus.emit(createLogEvent());
    });
  });

  describe('metric event routing', () => {
    it('should route metric events to onMetricEvent', () => {
      const onMetricEvent = vi.fn();
      const exporter = createMockExporter({ onMetricEvent });
      bus.registerExporter(exporter);

      const event = createMetricEvent();
      bus.emit(event);

      expect(onMetricEvent).toHaveBeenCalledWith(event);
    });

    it('should not fail when exporter has no onMetricEvent handler', () => {
      const exporter = createMockExporter({ onMetricEvent: undefined });
      bus.registerExporter(exporter);

      bus.emit(createMetricEvent());
    });
  });

  describe('score event routing', () => {
    it('should route score events to onScoreEvent', () => {
      const onScoreEvent = vi.fn();
      const exporter = createMockExporter({ onScoreEvent });
      bus.registerExporter(exporter);

      const event = createScoreEvent();
      bus.emit(event);

      expect(onScoreEvent).toHaveBeenCalledWith(event);
    });

    it('should not fail when exporter has no onScoreEvent handler', () => {
      const exporter = createMockExporter({ onScoreEvent: undefined });
      bus.registerExporter(exporter);

      bus.emit(createScoreEvent());
    });
  });

  describe('feedback event routing', () => {
    it('should route feedback events to onFeedbackEvent', () => {
      const onFeedbackEvent = vi.fn();
      const exporter = createMockExporter({ onFeedbackEvent });
      bus.registerExporter(exporter);

      const event = createFeedbackEvent();
      bus.emit(event);

      expect(onFeedbackEvent).toHaveBeenCalledWith(event);
    });

    it('should not fail when exporter has no onFeedbackEvent handler', () => {
      const exporter = createMockExporter({ onFeedbackEvent: undefined });
      bus.registerExporter(exporter);

      bus.emit(createFeedbackEvent());
    });
  });

  describe('selective signal support', () => {
    it('should only route events to exporters that implement the handler', () => {
      const tracingHandler = vi.fn();
      const logHandler = vi.fn();

      // Exporter 1: only supports tracing
      const tracingExporter = createMockExporter({
        name: 'tracing-only',
        onTracingEvent: tracingHandler,
        onLogEvent: undefined,
        onMetricEvent: undefined,
        onScoreEvent: undefined,
        onFeedbackEvent: undefined,
      });

      // Exporter 2: only supports logs
      const logExporter = createMockExporter({
        name: 'log-only',
        onTracingEvent: undefined,
        onLogEvent: logHandler,
        onMetricEvent: undefined,
        onScoreEvent: undefined,
        onFeedbackEvent: undefined,
      });

      bus.registerExporter(tracingExporter);
      bus.registerExporter(logExporter);

      // Emit tracing event
      bus.emit(createTracingEvent());
      expect(tracingHandler).toHaveBeenCalledTimes(1);
      expect(logHandler).not.toHaveBeenCalled();

      // Emit log event
      bus.emit(createLogEvent());
      expect(tracingHandler).toHaveBeenCalledTimes(1); // Still only once
      expect(logHandler).toHaveBeenCalledTimes(1);
    });

    it('should route all event types to a full-capability exporter', () => {
      const onTracingEvent = vi.fn();
      const onLogEvent = vi.fn();
      const onMetricEvent = vi.fn();
      const onScoreEvent = vi.fn();
      const onFeedbackEvent = vi.fn();

      const fullExporter = createMockExporter({
        name: 'full-exporter',
        onTracingEvent,
        onLogEvent,
        onMetricEvent,
        onScoreEvent,
        onFeedbackEvent,
      });

      bus.registerExporter(fullExporter);

      bus.emit(createTracingEvent());
      bus.emit(createLogEvent());
      bus.emit(createMetricEvent());
      bus.emit(createScoreEvent());
      bus.emit(createFeedbackEvent());

      expect(onTracingEvent).toHaveBeenCalledTimes(1);
      expect(onLogEvent).toHaveBeenCalledTimes(1);
      expect(onMetricEvent).toHaveBeenCalledTimes(1);
      expect(onScoreEvent).toHaveBeenCalledTimes(1);
      expect(onFeedbackEvent).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should handle synchronous handler errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorExporter = createMockExporter({
        name: 'error-exporter',
        onTracingEvent: () => {
          throw new Error('sync error');
        },
      });

      const goodExporter = createMockExporter({
        name: 'good-exporter',
        onTracingEvent: vi.fn(),
      });

      bus.registerExporter(errorExporter);
      bus.registerExporter(goodExporter);

      // Should not throw
      bus.emit(createTracingEvent());

      // Good exporter should still receive the event
      expect(goodExporter.onTracingEvent).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });

    it('should handle async handler rejections gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorExporter = createMockExporter({
        name: 'async-error-exporter',
        onLogEvent: vi.fn().mockRejectedValue(new Error('async error')),
      });

      const goodExporter = createMockExporter({
        name: 'good-exporter',
        onLogEvent: vi.fn(),
      });

      bus.registerExporter(errorExporter);
      bus.registerExporter(goodExporter);

      bus.emit(createLogEvent());

      // Give the async rejection handler time to fire
      await new Promise(resolve => setTimeout(resolve, 10));

      // Good exporter should still receive the event
      expect(goodExporter.onLogEvent).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });
  });

  describe('multiple exporters', () => {
    it('should route events to all matching exporters', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.registerExporter(createMockExporter({ name: 'exp-1', onTracingEvent: handler1 }));
      bus.registerExporter(createMockExporter({ name: 'exp-2', onTracingEvent: handler2 }));

      const event = createTracingEvent();
      bus.emit(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });
  });

  describe('backward compatibility', () => {
    it('should work with exporters that only implement exportTracingEvent (no onTracingEvent)', () => {
      // Exporter with no onTracingEvent handler - mimics old-style exporters
      const exporter = createMockExporter({
        onTracingEvent: undefined,
      });

      bus.registerExporter(exporter);

      const event = createTracingEvent();

      // Should not throw
      bus.emit(event);

      // exportTracingEvent should be called as a fallback when onTracingEvent is absent,
      // ensuring tracing events still reach exporters that don't implement onTracingEvent
      expect(exporter.exportTracingEvent).toHaveBeenCalledWith(event);
    });
  });

  // ==========================================================================
  // Bridge registration and routing
  // ==========================================================================

  describe('bridge registration', () => {
    it('should register and return bridge', () => {
      const bridge = createMockBridge({ name: 'test-bridge' });
      bus.registerBridge(bridge);

      expect(bus.getBridge()).toBe(bridge);
    });

    it('should unregister bridge', () => {
      const bridge = createMockBridge();
      bus.registerBridge(bridge);

      const removed = bus.unregisterBridge();
      expect(removed).toBe(true);
      expect(bus.getBridge()).toBeUndefined();
    });

    it('should return false when unregistering with no bridge registered', () => {
      expect(bus.unregisterBridge()).toBe(false);
    });

    it('should replace previously registered bridge', () => {
      const bridge1 = createMockBridge({ name: 'bridge-1' });
      const bridge2 = createMockBridge({ name: 'bridge-2' });

      bus.registerBridge(bridge1);
      bus.registerBridge(bridge2);

      expect(bus.getBridge()!.name).toBe('bridge-2');
    });
  });

  describe('bridge tracing event routing', () => {
    it('should route SPAN_STARTED to bridge onTracingEvent', () => {
      const onTracingEvent = vi.fn();
      const bridge = createMockBridge({ onTracingEvent });
      bus.registerBridge(bridge);

      const event = createTracingEvent(TracingEventType.SPAN_STARTED);
      bus.emit(event);

      expect(onTracingEvent).toHaveBeenCalledWith(event);
    });

    it('should route SPAN_ENDED to bridge onTracingEvent', () => {
      const onTracingEvent = vi.fn();
      const bridge = createMockBridge({ onTracingEvent });
      bus.registerBridge(bridge);

      const event = createTracingEvent(TracingEventType.SPAN_ENDED);
      bus.emit(event);

      expect(onTracingEvent).toHaveBeenCalledWith(event);
    });

    it('should fall back to exportTracingEvent when bridge has no onTracingEvent', () => {
      const bridge = createMockBridge({ onTracingEvent: undefined });
      bus.registerBridge(bridge);

      const event = createTracingEvent();
      bus.emit(event);

      expect(bridge.exportTracingEvent).toHaveBeenCalledWith(event);
    });
  });

  describe('bridge log event routing', () => {
    it('should route log events to bridge onLogEvent', () => {
      const onLogEvent = vi.fn();
      const bridge = createMockBridge({ onLogEvent });
      bus.registerBridge(bridge);

      const event = createLogEvent();
      bus.emit(event);

      expect(onLogEvent).toHaveBeenCalledWith(event);
    });

    it('should not fail when bridge has no onLogEvent handler', () => {
      const bridge = createMockBridge({ onLogEvent: undefined });
      bus.registerBridge(bridge);

      // Should not throw
      bus.emit(createLogEvent());
    });
  });

  describe('bridge metric event routing', () => {
    it('should route metric events to bridge onMetricEvent', () => {
      const onMetricEvent = vi.fn();
      const bridge = createMockBridge({ onMetricEvent });
      bus.registerBridge(bridge);

      const event = createMetricEvent();
      bus.emit(event);

      expect(onMetricEvent).toHaveBeenCalledWith(event);
    });

    it('should not fail when bridge has no onMetricEvent handler', () => {
      const bridge = createMockBridge({ onMetricEvent: undefined });
      bus.registerBridge(bridge);

      bus.emit(createMetricEvent());
    });
  });

  describe('bridge score event routing', () => {
    it('should route score events to bridge onScoreEvent', () => {
      const onScoreEvent = vi.fn();
      const bridge = createMockBridge({ onScoreEvent });
      bus.registerBridge(bridge);

      const event = createScoreEvent();
      bus.emit(event);

      expect(onScoreEvent).toHaveBeenCalledWith(event);
    });

    it('should not fail when bridge has no onScoreEvent handler', () => {
      const bridge = createMockBridge({ onScoreEvent: undefined });
      bus.registerBridge(bridge);

      bus.emit(createScoreEvent());
    });
  });

  describe('bridge feedback event routing', () => {
    it('should route feedback events to bridge onFeedbackEvent', () => {
      const onFeedbackEvent = vi.fn();
      const bridge = createMockBridge({ onFeedbackEvent });
      bus.registerBridge(bridge);

      const event = createFeedbackEvent();
      bus.emit(event);

      expect(onFeedbackEvent).toHaveBeenCalledWith(event);
    });

    it('should not fail when bridge has no onFeedbackEvent handler', () => {
      const bridge = createMockBridge({ onFeedbackEvent: undefined });
      bus.registerBridge(bridge);

      bus.emit(createFeedbackEvent());
    });
  });

  describe('bridge + exporter combined routing', () => {
    it('should route events to both exporters and bridge', () => {
      const exporterHandler = vi.fn();
      const bridgeHandler = vi.fn();

      const exporter = createMockExporter({ name: 'exp', onTracingEvent: exporterHandler });
      const bridge = createMockBridge({ name: 'brg', onTracingEvent: bridgeHandler });

      bus.registerExporter(exporter);
      bus.registerBridge(bridge);

      const event = createTracingEvent();
      bus.emit(event);

      expect(exporterHandler).toHaveBeenCalledWith(event);
      expect(bridgeHandler).toHaveBeenCalledWith(event);
    });

    it('should route all signal types to a full-capability bridge alongside exporters', () => {
      const exporterLog = vi.fn();
      const bridgeLog = vi.fn();
      const bridgeMetric = vi.fn();
      const bridgeScore = vi.fn();
      const bridgeFeedback = vi.fn();
      const bridgeTracing = vi.fn();

      const exporter = createMockExporter({ name: 'exp', onLogEvent: exporterLog });
      const bridge = createMockBridge({
        name: 'full-bridge',
        onTracingEvent: bridgeTracing,
        onLogEvent: bridgeLog,
        onMetricEvent: bridgeMetric,
        onScoreEvent: bridgeScore,
        onFeedbackEvent: bridgeFeedback,
      });

      bus.registerExporter(exporter);
      bus.registerBridge(bridge);

      bus.emit(createTracingEvent());
      bus.emit(createLogEvent());
      bus.emit(createMetricEvent());
      bus.emit(createScoreEvent());
      bus.emit(createFeedbackEvent());

      expect(bridgeTracing).toHaveBeenCalledTimes(1);
      expect(bridgeLog).toHaveBeenCalledTimes(1);
      expect(bridgeMetric).toHaveBeenCalledTimes(1);
      expect(bridgeScore).toHaveBeenCalledTimes(1);
      expect(bridgeFeedback).toHaveBeenCalledTimes(1);
      expect(exporterLog).toHaveBeenCalledTimes(1);
    });

    it('should handle bridge errors without affecting exporter delivery', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const exporterHandler = vi.fn();
      const exporter = createMockExporter({ name: 'exp', onLogEvent: exporterHandler });
      const bridge = createMockBridge({
        name: 'error-bridge',
        onLogEvent: () => {
          throw new Error('bridge error');
        },
      });

      bus.registerExporter(exporter);
      bus.registerBridge(bridge);

      // Should not throw
      bus.emit(createLogEvent());

      // Exporter should still receive the event
      expect(exporterHandler).toHaveBeenCalledTimes(1);

      consoleSpy.mockRestore();
    });

    it('should work when bridge is registered but only supports tracing', () => {
      // Bridge with no non-tracing handlers (typical OtelBridge pattern)
      const bridge = createMockBridge({
        name: 'tracing-only-bridge',
        onLogEvent: undefined,
        onMetricEvent: undefined,
        onScoreEvent: undefined,
        onFeedbackEvent: undefined,
      });

      bus.registerBridge(bridge);

      // All these should succeed without errors
      bus.emit(createLogEvent());
      bus.emit(createMetricEvent());
      bus.emit(createScoreEvent());
      bus.emit(createFeedbackEvent());
    });
  });

  // ==========================================================================
  // Promise tracking and flush
  // ==========================================================================

  describe('flush()', () => {
    it('should await pending async exporter handler promises', async () => {
      const order: string[] = [];

      const slowExporter = createMockExporter({
        name: 'slow',
        exportTracingEvent: vi.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          order.push('exporter-done');
        }),
        onTracingEvent: undefined,
      });

      bus.registerExporter(slowExporter);

      bus.emit(createTracingEvent());

      // Before flush, handler hasn't completed
      expect(order).not.toContain('exporter-done');

      await bus.flush();

      // After flush, handler must have completed
      expect(order).toContain('exporter-done');
    });

    it('should await pending async bridge handler promises', async () => {
      let bridgeDone = false;

      const bridge = createMockBridge({
        name: 'slow-bridge',
        exportTracingEvent: vi.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          bridgeDone = true;
        }),
        onTracingEvent: undefined,
      });

      bus.registerBridge(bridge);

      bus.emit(createTracingEvent());

      await bus.flush();
      expect(bridgeDone).toBe(true);
    });

    it('should await both exporter and bridge promises', async () => {
      const order: string[] = [];

      const exporter = createMockExporter({
        name: 'exp',
        onLogEvent: vi.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, 30));
          order.push('exporter');
        }),
      });

      const bridge = createMockBridge({
        name: 'brg',
        onLogEvent: vi.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, 20));
          order.push('bridge');
        }),
      });

      bus.registerExporter(exporter);
      bus.registerBridge(bridge);

      bus.emit(createLogEvent());
      expect(order).toHaveLength(0);

      await bus.flush();
      expect(order).toContain('exporter');
      expect(order).toContain('bridge');
    });

    it('should resolve immediately when no async handlers are pending', async () => {
      // Sync handler — no promises to track
      const exporter = createMockExporter({
        name: 'sync-exp',
        onTracingEvent: vi.fn(() => {}),
      });

      bus.registerExporter(exporter);
      bus.emit(createTracingEvent());

      const start = Date.now();
      await bus.flush();
      expect(Date.now() - start).toBeLessThan(10);
    });

    it('should handle rejected handler promises gracefully during flush', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      let goodExporterDone = false;

      const errorExporter = createMockExporter({
        name: 'error-exp',
        onTracingEvent: undefined,
        exportTracingEvent: vi.fn(async () => {
          throw new Error('export failed');
        }),
      });

      const goodExporter = createMockExporter({
        name: 'good-exp',
        onTracingEvent: undefined,
        exportTracingEvent: vi.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, 20));
          goodExporterDone = true;
        }),
      });

      bus.registerExporter(errorExporter);
      bus.registerExporter(goodExporter);

      bus.emit(createTracingEvent());
      await bus.flush();

      // Good exporter should still complete
      expect(goodExporterDone).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should self-clean resolved promises from the pending set', async () => {
      const exporter = createMockExporter({
        name: 'exp',
        onTracingEvent: undefined,
        exportTracingEvent: vi.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
        }),
      });

      bus.registerExporter(exporter);

      bus.emit(createTracingEvent());
      await bus.flush();

      // Second flush should resolve immediately
      const start = Date.now();
      await bus.flush();
      expect(Date.now() - start).toBeLessThan(10);
    });

    it('should call flush() on registered exporters during phase 2', async () => {
      const exporterFlush = vi.fn(async () => {});
      const exporter = createMockExporter({
        name: 'buffered-exp',
        flush: exporterFlush,
      });

      bus.registerExporter(exporter);
      bus.emit(createTracingEvent());

      await bus.flush();

      expect(exporterFlush).toHaveBeenCalledTimes(1);
    });

    it('should call flush() on the bridge during phase 2', async () => {
      const bridgeFlush = vi.fn(async () => {});
      const bridge = createMockBridge({
        name: 'buffered-bridge',
        flush: bridgeFlush,
      });

      bus.registerBridge(bridge);
      bus.emit(createTracingEvent());

      await bus.flush();

      expect(bridgeFlush).toHaveBeenCalledTimes(1);
    });

    it('should call exporter/bridge flush after handler delivery completes', async () => {
      const order: string[] = [];

      const exporter = createMockExporter({
        name: 'ordered-exp',
        onTracingEvent: undefined,
        exportTracingEvent: vi.fn(async () => {
          await new Promise(resolve => setTimeout(resolve, 30));
          order.push('handler-done');
        }),
        flush: vi.fn(async () => {
          order.push('exporter-flush');
        }),
      });

      bus.registerExporter(exporter);
      bus.emit(createTracingEvent());

      await bus.flush();

      // Handler must complete before exporter.flush() is called
      expect(order).toEqual(['handler-done', 'exporter-flush']);
    });
  });
});
