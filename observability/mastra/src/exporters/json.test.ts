import { existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan, TracingEvent } from '@mastra/core/observability';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { JsonExporter } from './json';

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

describe('JsonExporter', () => {
  let exporter: JsonExporter;

  beforeEach(() => {
    exporter = new JsonExporter({ validateLifecycle: true, storeLogs: true });
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
      const noLogExporter = new JsonExporter({ storeLogs: false });
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
      // causing the module to fail to load even if JsonExporter is never used.
      //
      // The fix moves the SNAPSHOTS_DIR initialization inside assertMatchesSnapshot(),
      // making it lazy and only executed when the testing functionality is actually needed.

      // Verify the JsonExporter class can be instantiated without errors
      // (proves the module loaded successfully without executing Node.js-specific code)
      const exporter = new JsonExporter();
      expect(exporter).toBeDefined();
      expect(exporter.name).toBe('json-exporter');

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
      // This test ensures that all other JsonExporter methods work without
      // needing the __snapshots__ directory path to be resolved.

      const exporter = new JsonExporter();

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

      const validatingExporter = new JsonExporter({
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

      const validatingExporter = new JsonExporter({
        logger,
        validateLifecycle: true,
      });

      const span = createMockSpan({ name: 'no-start', isEvent: false });

      await validatingExporter.exportTracingEvent(createEvent(TracingEventType.SPAN_ENDED, span));

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('ended without starting'));
    });
  });
});
