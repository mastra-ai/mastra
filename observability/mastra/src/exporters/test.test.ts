import { existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import type {
  AnyExportedSpan,
  TracingEvent,
  LogEvent,
  MetricEvent,
  ScoreEvent,
  FeedbackEvent,
  ExportedLog,
  ExportedMetric,
  ExportedScore,
  ExportedFeedback,
} from '@mastra/core/observability';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TestExporter } from './test';

// Helper to create mock spans
function createMockSpan(overrides: Partial<AnyExportedSpan> = {}): AnyExportedSpan {
  return {
    id: `span-${Math.random().toString(36).slice(2, 10)}`,
    traceId: 'trace-123',
    name: 'test-span',
    type: SpanType.AGENT_RUN,
    startTime: new Date(),
    isEvent: false,
    isRootSpan: false,
    ...overrides,
  } as AnyExportedSpan;
}

// Helper to create tracing events
function createEvent(type: TracingEventType, span: AnyExportedSpan): TracingEvent {
  return { type, exportedSpan: span } as TracingEvent;
}

describe('TestExporter', () => {
  let exporter: TestExporter;

  beforeEach(() => {
    exporter = new TestExporter({ validateLifecycle: true, storeLogs: true });
  });

  describe('basic event collection', () => {
    it('should collect events', async () => {
      const span = createMockSpan();

      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span, endTime: new Date() }));

      expect(exporter.events).toHaveLength(2);
    });

    it('should clear events on reset', async () => {
      const span = createMockSpan();
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));

      exporter.reset();

      expect(exporter.events).toHaveLength(0);
    });

    it('should clear events on clearEvents', async () => {
      const span = createMockSpan();
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));

      exporter.clearEvents();

      expect(exporter.events).toHaveLength(0);
    });
  });

  describe('span lifecycle tracking', () => {
    it('should track completed spans', async () => {
      const span = createMockSpan({ type: SpanType.TOOL_CALL });

      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span, endTime: new Date() }));

      const completed = exporter.getCompletedSpans();
      expect(completed).toHaveLength(1);
      expect(completed[0]?.type).toBe(SpanType.TOOL_CALL);
    });

    it('should track incomplete spans', async () => {
      const span = createMockSpan();
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));

      const incomplete = exporter.getIncompleteSpans();
      expect(incomplete).toHaveLength(1);
      expect(incomplete[0]?.spanId).toBe(span.id);
    });

    it('should handle event spans correctly (only SPAN_ENDED)', async () => {
      const eventSpan = createMockSpan({ isEvent: true });

      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, eventSpan));

      const completed = exporter.getCompletedSpans();
      expect(completed).toHaveLength(1);
      expect(exporter.getIncompleteSpans()).toHaveLength(0);
    });
  });

  describe('query methods', () => {
    it('should get spans by SpanType', async () => {
      const agentSpan = createMockSpan({ id: 'agent-1', type: SpanType.AGENT_RUN });
      const toolSpan = createMockSpan({ id: 'tool-1', type: SpanType.TOOL_CALL });

      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, agentSpan));
      await exporter.exportTracingEvent(
        createEvent(TracingEventType.SPAN_ENDED, { ...agentSpan, endTime: new Date() }),
      );
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, toolSpan));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...toolSpan, endTime: new Date() }));

      const agentSpans = exporter.getSpansByType(SpanType.AGENT_RUN);
      const toolSpans = exporter.getSpansByType(SpanType.TOOL_CALL);

      expect(agentSpans).toHaveLength(1);
      expect(toolSpans).toHaveLength(1);
      expect(agentSpans[0]?.id).toBe('agent-1');
      expect(toolSpans[0]?.id).toBe('tool-1');
    });

    it('should get events by TracingEventType', async () => {
      const span = createMockSpan();

      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_UPDATED, span));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span, endTime: new Date() }));

      expect(exporter.getByEventType(TracingEventType.SPAN_STARTED)).toHaveLength(1);
      expect(exporter.getByEventType(TracingEventType.SPAN_UPDATED)).toHaveLength(1);
      expect(exporter.getByEventType(TracingEventType.SPAN_ENDED)).toHaveLength(1);
    });

    it('should get spans by traceId', async () => {
      const span1 = createMockSpan({ id: 'span-1', traceId: 'trace-A' });
      const span2 = createMockSpan({ id: 'span-2', traceId: 'trace-B' });

      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span1));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span1, endTime: new Date() }));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span2));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span2, endTime: new Date() }));

      const traceA = exporter.getByTraceId('trace-A');
      const traceB = exporter.getByTraceId('trace-B');

      expect(traceA.events).toHaveLength(2);
      expect(traceA.spans).toHaveLength(1);
      expect(traceA.spans[0]?.id).toBe('span-1');

      expect(traceB.events).toHaveLength(2);
      expect(traceB.spans).toHaveLength(1);
      expect(traceB.spans[0]?.id).toBe('span-2');
    });

    it('should get span by spanId', async () => {
      const span = createMockSpan({ id: 'my-span' });

      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_UPDATED, span));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span, endTime: new Date() }));

      const result = exporter.getBySpanId('my-span');

      expect(result.events).toHaveLength(3);
      expect(result.span?.id).toBe('my-span');
      expect(result.state?.hasStart).toBe(true);
      expect(result.state?.hasUpdate).toBe(true);
      expect(result.state?.hasEnd).toBe(true);
    });

    it('should return empty for non-existent spanId', () => {
      const result = exporter.getBySpanId('non-existent');

      expect(result.events).toHaveLength(0);
      expect(result.span).toBeUndefined();
      expect(result.state).toBeUndefined();
    });

    it('should get root spans only', async () => {
      const rootSpan = createMockSpan({ id: 'root', isRootSpan: true });
      const childSpan = createMockSpan({ id: 'child', isRootSpan: false, parentSpanId: 'root' });

      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, rootSpan));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...rootSpan, endTime: new Date() }));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, childSpan));
      await exporter.exportTracingEvent(
        createEvent(TracingEventType.SPAN_ENDED, { ...childSpan, endTime: new Date() }),
      );

      const rootSpans = exporter.getRootSpans();

      expect(rootSpans).toHaveLength(1);
      expect(rootSpans[0]?.id).toBe('root');
    });

    it('should get all unique trace IDs', async () => {
      const span1 = createMockSpan({ traceId: 'trace-A' });
      const span2 = createMockSpan({ traceId: 'trace-B' });
      const span3 = createMockSpan({ traceId: 'trace-A' }); // Same trace as span1

      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span1));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span2));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span3));

      const traceIds = exporter.getTraceIds();

      expect(traceIds).toHaveLength(2);
      expect(traceIds).toContain('trace-A');
      expect(traceIds).toContain('trace-B');
    });
  });

  describe('statistics', () => {
    it('should calculate correct statistics', async () => {
      const span1 = createMockSpan({ id: 'span-1', type: SpanType.AGENT_RUN, traceId: 'trace-A' });
      const span2 = createMockSpan({ id: 'span-2', type: SpanType.TOOL_CALL, traceId: 'trace-A' });
      const span3 = createMockSpan({ id: 'span-3', type: SpanType.AGENT_RUN, traceId: 'trace-B' });

      // Complete span1 and span2
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span1));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_UPDATED, span1));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span1, endTime: new Date() }));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span2));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span2, endTime: new Date() }));

      // Leave span3 incomplete
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span3));

      const stats = exporter.getStatistics();

      expect(stats.totalEvents).toBe(6);
      expect(stats.totalSpans).toBe(3);
      expect(stats.totalTraces).toBe(2);
      expect(stats.completedSpans).toBe(2);
      expect(stats.incompleteSpans).toBe(1);
      expect(stats.byEventType.started).toBe(3);
      expect(stats.byEventType.updated).toBe(1);
      expect(stats.byEventType.ended).toBe(2);
      expect(stats.bySpanType[SpanType.AGENT_RUN]).toBe(1); // Only completed spans counted
      expect(stats.bySpanType[SpanType.TOOL_CALL]).toBe(1);
    });
  });

  describe('JSON output', () => {
    it('should serialize to JSON', async () => {
      const span = createMockSpan({ name: 'json-test-span' });
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span, endTime: new Date() }));

      const json = exporter.toJSON();
      const parsed = JSON.parse(json);

      expect(parsed.spans).toHaveLength(1);
      expect(parsed.spans[0].name).toBe('json-test-span');
      expect(parsed.events).toHaveLength(2);
      expect(parsed.statistics).toBeDefined();
      expect(parsed.statistics.totalSpans).toBe(1);
    });

    it('should respect toJSON options', async () => {
      const span = createMockSpan();
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span, endTime: new Date() }));

      // Without events
      const jsonNoEvents = JSON.parse(exporter.toJSON({ includeEvents: false }));
      expect(jsonNoEvents.events).toBeUndefined();
      expect(jsonNoEvents.spans).toBeDefined();

      // Without stats
      const jsonNoStats = JSON.parse(exporter.toJSON({ includeStats: false }));
      expect(jsonNoStats.statistics).toBeUndefined();
      expect(jsonNoStats.spans).toBeDefined();

      // Compact (no indent) - pass 0 for compact output
      const jsonCompact = exporter.toJSON({ indent: 0 });
      expect(jsonCompact).not.toContain('\n');
    });

    it('should serialize dates as ISO strings', async () => {
      const startTime = new Date('2024-01-15T10:30:00.000Z');
      const endTime = new Date('2024-01-15T10:31:00.000Z');
      const span = createMockSpan({ startTime, endTime });

      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, span));

      const json = exporter.toJSON();
      const parsed = JSON.parse(json);

      expect(parsed.spans[0].startTime).toBe('2024-01-15T10:30:00.000Z');
      expect(parsed.spans[0].endTime).toBe('2024-01-15T10:31:00.000Z');
    });
  });

  describe('file output', () => {
    const testFilePath = join(tmpdir(), `json-exporter-test-${Date.now()}.json`);

    afterEach(async () => {
      if (existsSync(testFilePath)) {
        await unlink(testFilePath);
      }
    });

    it('should write to file', async () => {
      const span = createMockSpan({ name: 'file-test-span' });
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span, endTime: new Date() }));

      await exporter.writeToFile(testFilePath);

      expect(existsSync(testFilePath)).toBe(true);

      const { readFile } = await import('node:fs/promises');
      const content = await readFile(testFilePath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.spans).toHaveLength(1);
      expect(parsed.spans[0].name).toBe('file-test-span');
    });
  });

  describe('validation', () => {
    it('should validate final state correctly for valid traces', async () => {
      const span = createMockSpan({ traceId: 'single-trace' });
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span, endTime: new Date() }));

      const validation = exporter.validateFinalState();

      expect(validation.valid).toBe(true);
      expect(validation.singleTraceId).toBe(true);
      expect(validation.allSpansComplete).toBe(true);
      expect(validation.traceIds).toHaveLength(1);
      expect(validation.incompleteSpans).toHaveLength(0);
    });

    it('should detect multiple trace IDs', async () => {
      const span1 = createMockSpan({ traceId: 'trace-A' });
      const span2 = createMockSpan({ traceId: 'trace-B' });

      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span1));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span1, endTime: new Date() }));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span2));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span2, endTime: new Date() }));

      const validation = exporter.validateFinalState();

      expect(validation.valid).toBe(false);
      expect(validation.singleTraceId).toBe(false);
      expect(validation.traceIds).toHaveLength(2);
    });

    it('should detect incomplete spans', async () => {
      const span = createMockSpan();
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));
      // No SPAN_ENDED

      const validation = exporter.validateFinalState();

      expect(validation.valid).toBe(false);
      expect(validation.allSpansComplete).toBe(false);
      expect(validation.incompleteSpans).toHaveLength(1);
    });
  });

  describe('logging', () => {
    it('should store logs when enabled', async () => {
      const span = createMockSpan({ name: 'logged-span' });
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));

      const logs = exporter.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0]).toContain('logged-span');
      expect(logs[0]).toContain('span_started');
    });

    it('should not store logs when disabled', async () => {
      const noLogExporter = new TestExporter({ storeLogs: false });
      const span = createMockSpan();

      await noLogExporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));

      expect(noLogExporter.getLogs()).toHaveLength(0);
    });

    it('should dump logs to console', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const span = createMockSpan({ name: 'dump-test' });
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));

      exporter.dumpLogs();

      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls.flat().join(' ');
      expect(calls).toContain('dump-test');

      consoleSpy.mockRestore();
    });
  });

  describe('cloudflare workers compatibility', () => {
    it('should not execute Node.js-specific code at module load time', async () => {
      // This test verifies the fix for GitHub issue #12536:
      // CloudFlare Workers deployment fails because fileURLToPath(import.meta.url)
      // is called at module initialization time, before any method is invoked.
      //
      // In CloudFlare Workers, import.meta.url is undefined during worker startup,
      // causing the module to fail to load even if TestExporter is never used.
      //
      // The fix moves the SNAPSHOTS_DIR initialization inside assertMatchesSnapshot(),
      // making it lazy and only executed when the testing functionality is actually needed.

      // Verify the TestExporter class can be instantiated without errors
      // (proves the module loaded successfully without executing Node.js-specific code)
      const exporter = new TestExporter();
      expect(exporter).toBeDefined();
      expect(exporter.name).toBe('test-exporter');

      // Verify basic functionality works without triggering snapshot-related code
      const span = createMockSpan({ name: 'cf-worker-test' });
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span, endTime: new Date() }));

      expect(exporter.getAllSpans()).toHaveLength(1);
      expect(exporter.toJSON()).toContain('cf-worker-test');
    });

    it('should only use fileURLToPath when assertMatchesSnapshot is called', async () => {
      // The fileURLToPath and dirname imports should only be used inside
      // assertMatchesSnapshot, not at module load time.
      //
      // This test ensures that all other TestExporter methods work without
      // needing the __snapshots__ directory path to be resolved.

      const exporter = new TestExporter();

      // All these operations should work without needing SNAPSHOTS_DIR:
      const span = createMockSpan({ name: 'snapshot-independence-test' });
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));
      await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span, endTime: new Date() }));

      // Query methods
      expect(exporter.getSpansByType(SpanType.AGENT_RUN)).toHaveLength(1);
      expect(exporter.getCompletedSpans()).toHaveLength(1);
      expect(exporter.getAllSpans()).toHaveLength(1);
      expect(exporter.getStatistics().totalSpans).toBe(1);

      // Output methods
      expect(exporter.toJSON()).toBeDefined();
      expect(exporter.toTreeJSON()).toBeDefined();
      expect(exporter.toNormalizedTreeJSON()).toBeDefined();
      expect(exporter.buildSpanTree()).toHaveLength(1);
      expect(exporter.buildNormalizedTree()).toHaveLength(1);
      expect(exporter.generateStructureGraph()).toHaveLength(1);
    });
  });

  describe('lifecycle validation warnings', () => {
    it('should warn when span starts twice', async () => {
      const logger: Record<'info' | 'warn' | 'error' | 'debug', ReturnType<typeof vi.fn>> = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const validatingExporter = new TestExporter({
        logger,
        validateLifecycle: true,
      });

      const span = createMockSpan({ name: 'double-start' });

      await validatingExporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));
      await validatingExporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('started twice'));
    });

    it('should warn when normal span ends without starting', async () => {
      const logger: Record<'info' | 'warn' | 'error' | 'debug', ReturnType<typeof vi.fn>> = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const validatingExporter = new TestExporter({
        logger,
        validateLifecycle: true,
      });

      const span = createMockSpan({ name: 'no-start', isEvent: false });

      await validatingExporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, span));

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('ended without starting'));
    });
  });
});

// ============================================================================
// Helpers for new signal types
// ============================================================================

function createMockLogEvent(overrides: Partial<ExportedLog> = {}): LogEvent {
  return {
    type: 'log',
    log: {
      timestamp: new Date(),
      level: 'info',
      message: 'test log message',
      ...overrides,
    },
  };
}

function createMockMetricEvent(overrides: Partial<ExportedMetric> = {}): MetricEvent {
  return {
    type: 'metric',
    metric: {
      timestamp: new Date(),
      name: 'mastra_test_counter',
      metricType: 'counter',
      value: 1,
      labels: { env: 'test' },
      ...overrides,
    },
  };
}

function createMockScoreEvent(overrides: Partial<ExportedScore> = {}): ScoreEvent {
  return {
    type: 'score',
    score: {
      timestamp: new Date(),
      traceId: 'trace-123',
      scorerName: 'relevance',
      score: 0.85,
      ...overrides,
    },
  };
}

function createMockFeedbackEvent(overrides: Partial<ExportedFeedback> = {}): FeedbackEvent {
  return {
    type: 'feedback',
    feedback: {
      timestamp: new Date(),
      traceId: 'trace-123',
      source: 'user',
      feedbackType: 'thumbs',
      value: 1,
      ...overrides,
    },
  };
}

// ============================================================================
// Tests for new signal handlers (Phase 2.2)
// ============================================================================

describe('TestExporter - Log Events', () => {
  let exporter: TestExporter;

  beforeEach(() => {
    exporter = new TestExporter({ storeLogs: true, logMetricsOnFlush: false });
  });

  it('should collect log events', async () => {
    await exporter.onLogEvent(createMockLogEvent());
    await exporter.onLogEvent(createMockLogEvent({ level: 'error', message: 'something failed' }));

    expect(exporter.getLogEvents()).toHaveLength(2);
    expect(exporter.getAllLogs()).toHaveLength(2);
  });

  it('should filter logs by level', async () => {
    await exporter.onLogEvent(createMockLogEvent({ level: 'info', message: 'info msg' }));
    await exporter.onLogEvent(createMockLogEvent({ level: 'error', message: 'error msg' }));
    await exporter.onLogEvent(createMockLogEvent({ level: 'warn', message: 'warn msg' }));
    await exporter.onLogEvent(createMockLogEvent({ level: 'info', message: 'info msg 2' }));

    const infoLogs = exporter.getLogsByLevel('info');
    const errorLogs = exporter.getLogsByLevel('error');

    expect(infoLogs).toHaveLength(2);
    expect(errorLogs).toHaveLength(1);
    expect(errorLogs[0]?.message).toBe('error msg');
  });

  it('should filter logs by traceId', async () => {
    await exporter.onLogEvent(createMockLogEvent({ traceId: 'trace-A', message: 'log A' }));
    await exporter.onLogEvent(createMockLogEvent({ traceId: 'trace-B', message: 'log B' }));
    await exporter.onLogEvent(createMockLogEvent({ traceId: 'trace-A', message: 'log A2' }));

    const logsA = exporter.getLogsByTraceId('trace-A');
    expect(logsA).toHaveLength(2);
    expect(logsA[0]?.message).toBe('log A');
    expect(logsA[1]?.message).toBe('log A2');
  });

  it('should store debug logs for log events when enabled', async () => {
    await exporter.onLogEvent(createMockLogEvent({ level: 'warn', message: 'check this' }));

    const debugLogs = exporter.getLogs();
    expect(debugLogs).toHaveLength(1);
    expect(debugLogs[0]).toContain('log.warn');
    expect(debugLogs[0]).toContain('check this');
  });

  it('should clear log events on reset', async () => {
    await exporter.onLogEvent(createMockLogEvent());
    expect(exporter.getAllLogs()).toHaveLength(1);

    exporter.reset();
    expect(exporter.getAllLogs()).toHaveLength(0);
  });
});

describe('TestExporter - Metric Events', () => {
  let exporter: TestExporter;

  beforeEach(() => {
    exporter = new TestExporter({ storeLogs: true, logMetricsOnFlush: false });
  });

  it('should collect metric events', async () => {
    await exporter.onMetricEvent(createMockMetricEvent());
    await exporter.onMetricEvent(
      createMockMetricEvent({ name: 'mastra_agent_duration_ms', metricType: 'histogram', value: 1500 }),
    );

    expect(exporter.getMetricEvents()).toHaveLength(2);
    expect(exporter.getAllMetrics()).toHaveLength(2);
  });

  it('should filter metrics by name', async () => {
    await exporter.onMetricEvent(createMockMetricEvent({ name: 'mastra_agent_runs_started' }));
    await exporter.onMetricEvent(
      createMockMetricEvent({ name: 'mastra_agent_duration_ms', metricType: 'histogram', value: 1500 }),
    );
    await exporter.onMetricEvent(createMockMetricEvent({ name: 'mastra_agent_runs_started' }));

    const startedMetrics = exporter.getMetricsByName('mastra_agent_runs_started');
    expect(startedMetrics).toHaveLength(2);
  });

  it('should filter metrics by type', async () => {
    await exporter.onMetricEvent(createMockMetricEvent({ metricType: 'counter' }));
    await exporter.onMetricEvent(createMockMetricEvent({ metricType: 'histogram', name: 'duration', value: 100 }));
    await exporter.onMetricEvent(createMockMetricEvent({ metricType: 'counter' }));
    await exporter.onMetricEvent(createMockMetricEvent({ metricType: 'gauge', name: 'active', value: 5 }));

    expect(exporter.getMetricsByType('counter')).toHaveLength(2);
    expect(exporter.getMetricsByType('histogram')).toHaveLength(1);
    expect(exporter.getMetricsByType('gauge')).toHaveLength(1);
  });

  it('should store debug logs for metric events', async () => {
    await exporter.onMetricEvent(
      createMockMetricEvent({ name: 'mastra_test', metricType: 'counter', value: 42, labels: { agent: 'test-agent' } }),
    );

    const debugLogs = exporter.getLogs();
    expect(debugLogs).toHaveLength(1);
    expect(debugLogs[0]).toContain('metric.counter');
    expect(debugLogs[0]).toContain('mastra_test=42');
    expect(debugLogs[0]).toContain('agent=test-agent');
  });

  it('should clear metric events on reset', async () => {
    await exporter.onMetricEvent(createMockMetricEvent());
    expect(exporter.getAllMetrics()).toHaveLength(1);

    exporter.reset();
    expect(exporter.getAllMetrics()).toHaveLength(0);
  });
});

describe('TestExporter - Score Events', () => {
  let exporter: TestExporter;

  beforeEach(() => {
    exporter = new TestExporter({ storeLogs: true, logMetricsOnFlush: false });
  });

  it('should collect score events', async () => {
    await exporter.onScoreEvent(createMockScoreEvent());
    await exporter.onScoreEvent(createMockScoreEvent({ scorerName: 'factuality', score: 0.92 }));

    expect(exporter.getScoreEvents()).toHaveLength(2);
    expect(exporter.getAllScores()).toHaveLength(2);
  });

  it('should filter scores by scorer name', async () => {
    await exporter.onScoreEvent(createMockScoreEvent({ scorerName: 'relevance', score: 0.85 }));
    await exporter.onScoreEvent(createMockScoreEvent({ scorerName: 'factuality', score: 0.92 }));
    await exporter.onScoreEvent(createMockScoreEvent({ scorerName: 'relevance', score: 0.9 }));

    const relevanceScores = exporter.getScoresByScorer('relevance');
    expect(relevanceScores).toHaveLength(2);
    expect(relevanceScores[0]?.score).toBe(0.85);
    expect(relevanceScores[1]?.score).toBe(0.9);
  });

  it('should filter scores by traceId', async () => {
    await exporter.onScoreEvent(createMockScoreEvent({ traceId: 'trace-A', scorerName: 'relevance' }));
    await exporter.onScoreEvent(createMockScoreEvent({ traceId: 'trace-B', scorerName: 'relevance' }));
    await exporter.onScoreEvent(createMockScoreEvent({ traceId: 'trace-A', scorerName: 'factuality' }));

    const scoresA = exporter.getScoresByTraceId('trace-A');
    expect(scoresA).toHaveLength(2);
  });

  it('should store debug logs for score events', async () => {
    await exporter.onScoreEvent(
      createMockScoreEvent({ traceId: 'abcdef1234567890', scorerName: 'relevance', score: 0.85 }),
    );

    const debugLogs = exporter.getLogs();
    expect(debugLogs).toHaveLength(1);
    expect(debugLogs[0]).toContain('score: relevance=0.85');
  });

  it('should clear score events on reset', async () => {
    await exporter.onScoreEvent(createMockScoreEvent());
    expect(exporter.getAllScores()).toHaveLength(1);

    exporter.reset();
    expect(exporter.getAllScores()).toHaveLength(0);
  });
});

describe('TestExporter - Feedback Events', () => {
  let exporter: TestExporter;

  beforeEach(() => {
    exporter = new TestExporter({ storeLogs: true, logMetricsOnFlush: false });
  });

  it('should collect feedback events', async () => {
    await exporter.onFeedbackEvent(createMockFeedbackEvent());
    await exporter.onFeedbackEvent(createMockFeedbackEvent({ feedbackType: 'rating', value: 4 }));

    expect(exporter.getFeedbackEvents()).toHaveLength(2);
    expect(exporter.getAllFeedback()).toHaveLength(2);
  });

  it('should filter feedback by type', async () => {
    await exporter.onFeedbackEvent(createMockFeedbackEvent({ feedbackType: 'thumbs', value: 1 }));
    await exporter.onFeedbackEvent(createMockFeedbackEvent({ feedbackType: 'rating', value: 4 }));
    await exporter.onFeedbackEvent(createMockFeedbackEvent({ feedbackType: 'thumbs', value: -1 }));

    const thumbsFeedback = exporter.getFeedbackByType('thumbs');
    expect(thumbsFeedback).toHaveLength(2);
  });

  it('should filter feedback by traceId', async () => {
    await exporter.onFeedbackEvent(createMockFeedbackEvent({ traceId: 'trace-A' }));
    await exporter.onFeedbackEvent(createMockFeedbackEvent({ traceId: 'trace-B' }));
    await exporter.onFeedbackEvent(createMockFeedbackEvent({ traceId: 'trace-A' }));

    const feedbackA = exporter.getFeedbackByTraceId('trace-A');
    expect(feedbackA).toHaveLength(2);
  });

  it('should store debug logs for feedback events', async () => {
    await exporter.onFeedbackEvent(
      createMockFeedbackEvent({
        traceId: 'abcdef1234567890',
        source: 'user',
        feedbackType: 'thumbs',
        value: 1,
      }),
    );

    const debugLogs = exporter.getLogs();
    expect(debugLogs).toHaveLength(1);
    expect(debugLogs[0]).toContain('feedback: thumbs from user=1');
  });

  it('should clear feedback events on reset', async () => {
    await exporter.onFeedbackEvent(createMockFeedbackEvent());
    expect(exporter.getAllFeedback()).toHaveLength(1);

    exporter.reset();
    expect(exporter.getAllFeedback()).toHaveLength(0);
  });
});

describe('TestExporter - Cross-Signal Integration', () => {
  let exporter: TestExporter;

  beforeEach(() => {
    exporter = new TestExporter({ storeLogs: true, logMetricsOnFlush: false });
  });

  it('should include all signals in getByTraceId', async () => {
    const traceId = 'trace-cross-signal';
    const span = createMockSpan({ traceId });

    await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));
    await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span, endTime: new Date() }));
    await exporter.onLogEvent(createMockLogEvent({ traceId, message: 'correlated log' }));
    await exporter.onScoreEvent(createMockScoreEvent({ traceId, scorerName: 'accuracy' }));
    await exporter.onFeedbackEvent(createMockFeedbackEvent({ traceId }));

    const result = exporter.getByTraceId(traceId);

    expect(result.events).toHaveLength(2); // tracing events
    expect(result.spans).toHaveLength(1);
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]?.message).toBe('correlated log');
    expect(result.scores).toHaveLength(1);
    expect(result.scores[0]?.scorerName).toBe('accuracy');
    expect(result.feedback).toHaveLength(1);
  });

  it('should include trace IDs from all signal types in getTraceIds', async () => {
    const span = createMockSpan({ traceId: 'trace-from-span' });
    await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));
    await exporter.onLogEvent(createMockLogEvent({ traceId: 'trace-from-log' }));
    await exporter.onScoreEvent(createMockScoreEvent({ traceId: 'trace-from-score' }));
    await exporter.onFeedbackEvent(createMockFeedbackEvent({ traceId: 'trace-from-feedback' }));

    const traceIds = exporter.getTraceIds();

    expect(traceIds).toHaveLength(4);
    expect(traceIds).toContain('trace-from-span');
    expect(traceIds).toContain('trace-from-log');
    expect(traceIds).toContain('trace-from-score');
    expect(traceIds).toContain('trace-from-feedback');
  });

  it('should include all signals in toJSON output', async () => {
    const span = createMockSpan();
    await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));
    await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span, endTime: new Date() }));
    await exporter.onLogEvent(createMockLogEvent({ message: 'test log' }));
    await exporter.onMetricEvent(createMockMetricEvent({ name: 'test_metric' }));
    await exporter.onScoreEvent(createMockScoreEvent({ scorerName: 'test_scorer' }));
    await exporter.onFeedbackEvent(createMockFeedbackEvent({ feedbackType: 'test_feedback' }));

    const json = exporter.toJSON();
    const parsed = JSON.parse(json);

    expect(parsed.spans).toHaveLength(1);
    expect(parsed.logs).toHaveLength(1);
    expect(parsed.logs[0].message).toBe('test log');
    expect(parsed.metrics).toHaveLength(1);
    expect(parsed.metrics[0].name).toBe('test_metric');
    expect(parsed.scores).toHaveLength(1);
    expect(parsed.scores[0].scorerName).toBe('test_scorer');
    expect(parsed.feedback).toHaveLength(1);
    expect(parsed.feedback[0].feedbackType).toBe('test_feedback');
  });

  it('should omit empty signal arrays from toJSON output', async () => {
    const span = createMockSpan();
    await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));
    await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span, endTime: new Date() }));

    const json = exporter.toJSON();
    const parsed = JSON.parse(json);

    expect(parsed.spans).toHaveLength(1);
    expect(parsed.logs).toBeUndefined();
    expect(parsed.metrics).toBeUndefined();
    expect(parsed.scores).toBeUndefined();
    expect(parsed.feedback).toBeUndefined();
  });

  it('should clear all signals on reset', async () => {
    const span = createMockSpan();
    await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));
    await exporter.onLogEvent(createMockLogEvent());
    await exporter.onMetricEvent(createMockMetricEvent());
    await exporter.onScoreEvent(createMockScoreEvent());
    await exporter.onFeedbackEvent(createMockFeedbackEvent());

    exporter.reset();

    expect(exporter.events).toHaveLength(0);
    expect(exporter.getAllLogs()).toHaveLength(0);
    expect(exporter.getAllMetrics()).toHaveLength(0);
    expect(exporter.getAllScores()).toHaveLength(0);
    expect(exporter.getAllFeedback()).toHaveLength(0);
    expect(exporter.getLogs()).toHaveLength(0); // debug logs
  });
});

describe('TestExporter - Statistics with All Signals', () => {
  let exporter: TestExporter;

  beforeEach(() => {
    exporter = new TestExporter({ logMetricsOnFlush: false });
  });

  it('should include all signal statistics', async () => {
    const span = createMockSpan({ id: 'span-1', type: SpanType.AGENT_RUN });
    await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));
    await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span, endTime: new Date() }));

    await exporter.onLogEvent(createMockLogEvent({ level: 'info' }));
    await exporter.onLogEvent(createMockLogEvent({ level: 'error' }));
    await exporter.onLogEvent(createMockLogEvent({ level: 'info' }));

    await exporter.onMetricEvent(createMockMetricEvent({ name: 'counter_a', metricType: 'counter' }));
    await exporter.onMetricEvent(createMockMetricEvent({ name: 'hist_a', metricType: 'histogram', value: 100 }));

    await exporter.onScoreEvent(createMockScoreEvent({ scorerName: 'relevance' }));
    await exporter.onScoreEvent(createMockScoreEvent({ scorerName: 'factuality' }));
    await exporter.onScoreEvent(createMockScoreEvent({ scorerName: 'relevance' }));

    await exporter.onFeedbackEvent(createMockFeedbackEvent({ feedbackType: 'thumbs' }));
    await exporter.onFeedbackEvent(createMockFeedbackEvent({ feedbackType: 'rating' }));

    const stats = exporter.getStatistics();

    // Tracing stats
    expect(stats.totalTracingEvents).toBe(2);
    expect(stats.totalEvents).toBe(2); // deprecated alias
    expect(stats.totalSpans).toBe(1);
    expect(stats.completedSpans).toBe(1);

    // Log stats
    expect(stats.totalLogs).toBe(3);
    expect(stats.logsByLevel.info).toBe(2);
    expect(stats.logsByLevel.error).toBe(1);

    // Metric stats
    expect(stats.totalMetrics).toBe(2);
    expect(stats.metricsByType.counter).toBe(1);
    expect(stats.metricsByType.histogram).toBe(1);
    expect(stats.metricsByName.counter_a).toBe(1);
    expect(stats.metricsByName.hist_a).toBe(1);

    // Score stats
    expect(stats.totalScores).toBe(3);
    expect(stats.scoresByScorer.relevance).toBe(2);
    expect(stats.scoresByScorer.factuality).toBe(1);

    // Feedback stats
    expect(stats.totalFeedback).toBe(2);
    expect(stats.feedbackByType.thumbs).toBe(1);
    expect(stats.feedbackByType.rating).toBe(1);
  });
});

describe('TestExporter - Internal Metrics', () => {
  it('should track internal metrics across all signal types', async () => {
    const exporter = new TestExporter({ logMetricsOnFlush: false });

    const span = createMockSpan();
    await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));
    await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, { ...span, endTime: new Date() }));
    await exporter.onLogEvent(createMockLogEvent());
    await exporter.onMetricEvent(createMockMetricEvent());
    await exporter.onScoreEvent(createMockScoreEvent());
    await exporter.onFeedbackEvent(createMockFeedbackEvent());

    const metrics = exporter.getInternalMetrics();

    expect(metrics.totalEventsReceived).toBe(6);
    expect(metrics.bySignal.tracing).toBe(2);
    expect(metrics.bySignal.log).toBe(1);
    expect(metrics.bySignal.metric).toBe(1);
    expect(metrics.bySignal.score).toBe(1);
    expect(metrics.bySignal.feedback).toBe(1);
    expect(metrics.flushCount).toBe(0);
    expect(metrics.startedAt).toBeInstanceOf(Date);
    expect(metrics.lastEventAt).toBeInstanceOf(Date);
    expect(metrics.estimatedJsonBytes).toBeGreaterThan(0);
  });

  it('should track flush count', async () => {
    const exporter = new TestExporter({ logMetricsOnFlush: false });

    await exporter.flush();
    await exporter.flush();
    await exporter.flush();

    const metrics = exporter.getInternalMetrics();
    expect(metrics.flushCount).toBe(3);
  });

  it('should log summary on flush when logMetricsOnFlush is true', async () => {
    const logger: Record<'info' | 'warn' | 'error' | 'debug', ReturnType<typeof vi.fn>> = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const exporter = new TestExporter({ logger, logMetricsOnFlush: true });

    const span = createMockSpan();
    await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, span));
    await exporter.onLogEvent(createMockLogEvent());

    await exporter.flush();

    expect(logger.info).toHaveBeenCalled();
    const flushCall = logger.info.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('flush #1 summary'),
    );
    expect(flushCall).toBeDefined();
    expect(flushCall[0]).toContain('tracing=1');
    expect(flushCall[0]).toContain('log=1');
  });

  it('should not log summary on flush when logMetricsOnFlush is false', async () => {
    const logger: Record<'info' | 'warn' | 'error' | 'debug', ReturnType<typeof vi.fn>> = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const exporter = new TestExporter({ logger, logMetricsOnFlush: false });

    await exporter.exportTracingEvent(createEvent(TracingEventType.SPAN_STARTED, createMockSpan()));
    await exporter.flush();

    // Should not have logged any flush summary (only other potential logger calls)
    const flushCalls = logger.info.mock.calls.filter(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('flush'),
    );
    expect(flushCalls).toHaveLength(0);
  });

  it('should report lastEventAt as null when no events received', () => {
    const exporter = new TestExporter({ logMetricsOnFlush: false });

    const metrics = exporter.getInternalMetrics();
    expect(metrics.lastEventAt).toBeNull();
    expect(metrics.totalEventsReceived).toBe(0);
  });

  it('should not reset internal metrics on clearEvents', async () => {
    const exporter = new TestExporter({ logMetricsOnFlush: false });

    await exporter.onLogEvent(createMockLogEvent());
    await exporter.onMetricEvent(createMockMetricEvent());

    exporter.clearEvents();

    // Events should be cleared
    expect(exporter.getAllLogs()).toHaveLength(0);
    expect(exporter.getAllMetrics()).toHaveLength(0);

    // But internal metrics should still reflect total history
    const metrics = exporter.getInternalMetrics();
    expect(metrics.totalEventsReceived).toBe(2);
    expect(metrics.bySignal.log).toBe(1);
    expect(metrics.bySignal.metric).toBe(1);
  });
});
