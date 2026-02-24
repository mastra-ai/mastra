/**
 * Unit tests for ObservabilityBus - type-based event routing to exporters.
 */

import { SpanType, TracingEventType } from '@mastra/core/observability';
import type {
  ObservabilityExporter,
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
});
