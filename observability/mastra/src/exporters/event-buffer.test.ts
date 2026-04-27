import { SpanType, TracingEventType } from '@mastra/core/observability';
import type {
  TracingEvent,
  AnyExportedSpan,
  MetricEvent,
  LogEvent,
  ScoreEvent,
  FeedbackEvent,
} from '@mastra/core/observability';
import type { CreateSpanRecord } from '@mastra/core/storage';
import { describe, it, expect } from 'vitest';
import { EventBuffer } from './event-buffer';

function createTracingEvent(
  type: TracingEventType,
  traceId = 'trace-1',
  spanId = 'span-1',
  isEvent = false,
): TracingEvent {
  return {
    type,
    exportedSpan: {
      id: spanId,
      traceId,
      type: SpanType.GENERIC,
      name: 'test-span',
      startTime: new Date(),
      endTime: type === TracingEventType.SPAN_ENDED ? new Date() : undefined,
      isEvent,
      attributes: { test: 'value' },
      metadata: undefined,
      input: 'test input',
      output: type === TracingEventType.SPAN_ENDED ? 'test output' : undefined,
    } as any as AnyExportedSpan,
  };
}

function createMetricEvent(): MetricEvent {
  return {
    type: 'metric',
    metric: { metricId: 'metric-test', timestamp: new Date(), name: 'test', value: 1, labels: {} },
  };
}

function createLogEvent(): LogEvent {
  return {
    type: 'log',
    log: { logId: 'log-test', timestamp: new Date(), level: 'info', message: 'test' },
  };
}

function createScoreEvent(): ScoreEvent {
  return {
    type: 'score',
    score: { scoreId: 'score-test', timestamp: new Date(), traceId: 'trace-1', scorerId: 'test', score: 0.5 },
  };
}

function createFeedbackEvent(): FeedbackEvent {
  return {
    type: 'feedback',
    feedback: {
      feedbackId: 'feedback-test',
      timestamp: new Date(),
      traceId: 'trace-1',
      source: 'user',
      feedbackType: 'thumbs',
      value: 1,
    },
  };
}

function createSpanRecord(traceId: string, spanId: string, isEvent = false): CreateSpanRecord {
  return {
    traceId,
    spanId,
    parentSpanId: null,
    name: 'test',
    entityType: null,
    entityId: null,
    entityName: null,
    userId: null,
    organizationId: null,
    resourceId: null,
    runId: null,
    sessionId: null,
    threadId: null,
    requestId: null,
    environment: null,
    source: null,
    serviceName: null,
    scope: null,
    spanType: SpanType.GENERIC,
    attributes: null,
    metadata: null,
    tags: null,
    links: null,
    input: null,
    output: null,
    error: null,
    isEvent,
    startedAt: new Date(),
    endedAt: null,
  };
}

describe('EventBuffer', () => {
  describe('preInit buffering', () => {
    it('should buffer events before init and replay on init', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_STARTED));
      buffer.addEvent(createMetricEvent());

      // Before init, nothing in creates/updates
      expect(buffer.totalSize).toBe(0);

      buffer.init({ strategy: 'batch-with-updates' });

      // After init, preInit events are replayed
      expect(buffer.totalSize).toBe(2);
      expect(buffer.creates).toHaveLength(2);
    });

    it('should not re-init if already initialized', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'batch-with-updates' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_STARTED));
      expect(buffer.creates).toHaveLength(1);

      // Second init should be a no-op
      buffer.init({ strategy: 'insert-only' });

      // Strategy should still be batch-with-updates (SPAN_STARTED was accepted)
      expect(buffer.creates).toHaveLength(1);
    });
  });

  describe('addEvent routing — batch-with-updates', () => {
    it('should route SPAN_STARTED to creates', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'batch-with-updates' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_STARTED));

      expect(buffer.creates).toHaveLength(1);
      expect(buffer.updates).toHaveLength(0);
    });

    it('should route SPAN_UPDATED to updates', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'batch-with-updates' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_UPDATED));

      expect(buffer.creates).toHaveLength(0);
      expect(buffer.updates).toHaveLength(1);
    });

    it('should route SPAN_ENDED to updates for non-event spans', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'batch-with-updates' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_ENDED, 'trace-1', 'span-1', false));

      expect(buffer.creates).toHaveLength(0);
      expect(buffer.updates).toHaveLength(1);
    });

    it('should route SPAN_ENDED to creates for event spans', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'batch-with-updates' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_ENDED, 'trace-1', 'span-1', true));

      expect(buffer.creates).toHaveLength(1);
      expect(buffer.updates).toHaveLength(0);
    });

    it('should route non-tracing signals to creates', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'batch-with-updates' });

      buffer.addEvent(createMetricEvent());
      buffer.addEvent(createLogEvent());
      buffer.addEvent(createScoreEvent());
      buffer.addEvent(createFeedbackEvent());

      expect(buffer.creates).toHaveLength(4);
      expect(buffer.updates).toHaveLength(0);
    });
  });

  describe('addEvent routing — insert-only', () => {
    it('should ignore SPAN_STARTED', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'insert-only' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_STARTED));

      expect(buffer.totalSize).toBe(0);
    });

    it('should ignore SPAN_UPDATED', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'insert-only' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_UPDATED));

      expect(buffer.totalSize).toBe(0);
    });

    it('should route SPAN_ENDED to creates', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'insert-only' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_ENDED));

      expect(buffer.creates).toHaveLength(1);
      expect(buffer.updates).toHaveLength(0);
    });
  });

  describe('addEvent routing — event-sourced', () => {
    it('should route SPAN_STARTED to creates', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'event-sourced' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_STARTED));

      expect(buffer.creates).toHaveLength(1);
    });

    it('should ignore SPAN_UPDATED', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'event-sourced' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_UPDATED));

      expect(buffer.totalSize).toBe(0);
    });

    it('should route SPAN_ENDED to creates (not updates)', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'event-sourced' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_ENDED));

      expect(buffer.creates).toHaveLength(1);
      expect(buffer.updates).toHaveLength(0);
    });
  });

  describe('addEvent routing — realtime', () => {
    it('should route SPAN_STARTED to creates', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'realtime' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_STARTED));

      expect(buffer.creates).toHaveLength(1);
    });

    it('should route SPAN_UPDATED to updates', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'realtime' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_UPDATED));

      expect(buffer.updates).toHaveLength(1);
    });

    it('should route SPAN_ENDED to updates for non-event spans', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'realtime' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_ENDED, 'trace-1', 'span-1', false));

      expect(buffer.updates).toHaveLength(1);
    });
  });

  describe('reset', () => {
    it('should clear creates and updates', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'batch-with-updates' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_STARTED));
      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_UPDATED));
      expect(buffer.totalSize).toBe(2);

      buffer.reset();

      expect(buffer.totalSize).toBe(0);
      expect(buffer.creates).toHaveLength(0);
      expect(buffer.updates).toHaveLength(0);
    });

    it('should reset elapsed time', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'batch-with-updates' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_STARTED));
      expect(buffer.elapsed).toBeGreaterThanOrEqual(0);

      buffer.reset();
      expect(buffer.elapsed).toBe(0);
    });
  });

  describe('reAddCreates', () => {
    it('should re-add events under maxRetries', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'batch-with-updates' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_STARTED));
      const creates = buffer.creates;
      buffer.reset();

      buffer.reAddCreates(creates);

      expect(buffer.creates).toHaveLength(1);
      expect(buffer.creates[0].retryCount).toBe(1);
    });

    it('should drop events after maxRetries retries', () => {
      const buffer = new EventBuffer({ maxRetries: 2 });
      buffer.init({ strategy: 'batch-with-updates' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_STARTED));
      const creates = buffer.creates;
      buffer.reset();

      // First re-add: retryCount goes 0→1, under maxRetries=2
      buffer.reAddCreates(creates);
      expect(buffer.creates).toHaveLength(1);

      const creates2 = buffer.creates;
      buffer.reset();

      // Second re-add: retryCount goes 1→2, equals maxRetries=2, still re-added
      buffer.reAddCreates(creates2);
      expect(buffer.creates).toHaveLength(1);

      const creates3 = buffer.creates;
      buffer.reset();

      // Third re-add: retryCount goes 2→3, exceeds maxRetries=2, dropped
      buffer.reAddCreates(creates3);
      expect(buffer.creates).toHaveLength(0);
    });
  });

  describe('reAddUpdates', () => {
    it('should re-add update events under maxRetries', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'batch-with-updates' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_UPDATED));
      const updates = buffer.updates;
      buffer.reset();

      buffer.reAddUpdates(updates);

      expect(buffer.updates).toHaveLength(1);
      expect(buffer.updates[0].retryCount).toBe(1);
    });
  });

  describe('span tracking', () => {
    it('should track created spans for batch-with-updates', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'batch-with-updates' });

      const record = createSpanRecord('trace-1', 'span-1');
      buffer.addCreatedSpans({ records: [record] });

      expect(buffer.spanExists({ traceId: 'trace-1', id: 'span-1' } as AnyExportedSpan)).toBe(true);
      expect(buffer.spanExists({ traceId: 'trace-1', id: 'span-2' } as AnyExportedSpan)).toBe(false);
    });

    it('should not track spans for event-sourced strategy', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'event-sourced' });

      const record = createSpanRecord('trace-1', 'span-1');
      buffer.addCreatedSpans({ records: [record] });

      expect(buffer.spanExists({ traceId: 'trace-1', id: 'span-1' } as AnyExportedSpan)).toBe(false);
    });

    it('should not track spans for insert-only strategy', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'insert-only' });

      const record = createSpanRecord('trace-1', 'span-1');
      buffer.addCreatedSpans({ records: [record] });

      expect(buffer.spanExists({ traceId: 'trace-1', id: 'span-1' } as AnyExportedSpan)).toBe(false);
    });

    it('should not track event-type spans', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'batch-with-updates' });

      const record = createSpanRecord('trace-1', 'event-1', true);
      buffer.addCreatedSpans({ records: [record] });

      expect(buffer.spanExists({ traceId: 'trace-1', id: 'event-1' } as AnyExportedSpan)).toBe(false);
    });

    it('should remove spans on endFinishedSpans', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'batch-with-updates' });

      const record = createSpanRecord('trace-1', 'span-1');
      buffer.addCreatedSpans({ records: [record] });
      expect(buffer.spanExists({ traceId: 'trace-1', id: 'span-1' } as AnyExportedSpan)).toBe(true);

      buffer.endFinishedSpans({
        records: [{ traceId: 'trace-1', spanId: 'span-1', updates: {} }],
      });
      expect(buffer.spanExists({ traceId: 'trace-1', id: 'span-1' } as AnyExportedSpan)).toBe(false);
    });

    it('should be a no-op for endFinishedSpans on event-sourced', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'event-sourced' });

      // Should not throw
      buffer.endFinishedSpans({
        records: [{ traceId: 'trace-1', spanId: 'span-1', updates: {} }],
      });
    });
  });

  describe('totalSize and elapsed', () => {
    it('should return combined size of creates and updates', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'batch-with-updates' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_STARTED));
      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_UPDATED));
      buffer.addEvent(createMetricEvent());

      expect(buffer.totalSize).toBe(3);
    });

    it('should return 0 elapsed when no events', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      expect(buffer.elapsed).toBe(0);
    });

    it('should track elapsed time from first event', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'batch-with-updates' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_STARTED));

      expect(buffer.elapsed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('snapshot immutability', () => {
    it('creates getter should return a copy', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'batch-with-updates' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_STARTED));

      const snapshot = buffer.creates;
      snapshot.push({ type: 'metric', metric: {} as any, retryCount: 0 });

      // Original buffer should not be affected
      expect(buffer.creates).toHaveLength(1);
    });

    it('updates getter should return a copy', () => {
      const buffer = new EventBuffer({ maxRetries: 3 });
      buffer.init({ strategy: 'batch-with-updates' });

      buffer.addEvent(createTracingEvent(TracingEventType.SPAN_UPDATED));

      const snapshot = buffer.updates;
      snapshot.push({ type: 'metric', metric: {} as any, retryCount: 0 });

      expect(buffer.updates).toHaveLength(1);
    });
  });
});
