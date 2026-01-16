/**
 * Unit tests for BaseExporter and customSpanFormatter functionality.
 */

import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { TracingEvent, AnyExportedSpan, CustomSpanFormatter } from '@mastra/core/observability';
import { describe, it, expect, vi } from 'vitest';
import { BaseExporter } from './base';
import type { BaseExporterConfig } from './base';
import { chainFormatters } from './span-formatters';

// Test implementation of BaseExporter
class TestExporter extends BaseExporter {
  name = 'test-exporter';

  public exportedEvents: TracingEvent[] = [];

  constructor(config: BaseExporterConfig = {}) {
    super(config);
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    this.exportedEvents.push(event);
  }
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
    input: { messages: [{ role: 'user', content: 'Hello' }] },
    output: { text: 'Hi there!' },
    ...overrides,
  };
}

function createTracingEvent(span: AnyExportedSpan): TracingEvent {
  return {
    type: TracingEventType.SPAN_ENDED,
    exportedSpan: span,
  };
}

describe('BaseExporter', () => {
  describe('customSpanFormatter', () => {
    it('should apply customSpanFormatter to exported spans', async () => {
      const formatter: CustomSpanFormatter = span => ({
        ...span,
        input: 'formatted-input',
        output: 'formatted-output',
      });

      const exporter = new TestExporter({ customSpanFormatter: formatter });
      const span = createMockSpan();
      const event = createTracingEvent(span);

      await exporter.exportTracingEvent(event);

      expect(exporter.exportedEvents).toHaveLength(1);
      expect(exporter.exportedEvents[0].exportedSpan.input).toBe('formatted-input');
      expect(exporter.exportedEvents[0].exportedSpan.output).toBe('formatted-output');
    });

    it('should not modify span when no formatter is configured', async () => {
      const exporter = new TestExporter();
      const span = createMockSpan({
        input: 'original-input',
        output: 'original-output',
      });
      const event = createTracingEvent(span);

      await exporter.exportTracingEvent(event);

      expect(exporter.exportedEvents).toHaveLength(1);
      expect(exporter.exportedEvents[0].exportedSpan.input).toBe('original-input');
      expect(exporter.exportedEvents[0].exportedSpan.output).toBe('original-output');
    });

    it('should handle formatter errors gracefully and use original span', async () => {
      const errorFormatter: CustomSpanFormatter = () => {
        throw new Error('Formatter error');
      };

      const logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const exporter = new TestExporter({
        customSpanFormatter: errorFormatter,
        logger: logger as any,
      });
      const span = createMockSpan({
        input: 'original-input',
      });
      const event = createTracingEvent(span);

      await exporter.exportTracingEvent(event);

      // Should use original span when formatter throws
      expect(exporter.exportedEvents).toHaveLength(1);
      expect(exporter.exportedEvents[0].exportedSpan.input).toBe('original-input');
      // Should log the error
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in customSpanFormatter'),
        expect.any(Object),
      );
    });

    it('should allow selective formatting based on span type', async () => {
      const formatter: CustomSpanFormatter = span => {
        if (span.type === SpanType.AGENT_RUN) {
          return { ...span, input: 'agent-formatted' };
        }
        return span;
      };

      const exporter = new TestExporter({ customSpanFormatter: formatter });

      // AGENT_RUN span should be formatted
      const agentSpan = createMockSpan({
        id: 'span-1',
        type: SpanType.AGENT_RUN,
        input: 'original',
      });
      await exporter.exportTracingEvent(createTracingEvent(agentSpan));

      // TOOL_CALL span should NOT be formatted
      const toolSpan = createMockSpan({
        id: 'span-2',
        type: SpanType.TOOL_CALL,
        input: 'original',
      });
      await exporter.exportTracingEvent(createTracingEvent(toolSpan));

      expect(exporter.exportedEvents).toHaveLength(2);
      expect(exporter.exportedEvents[0].exportedSpan.input).toBe('agent-formatted');
      expect(exporter.exportedEvents[1].exportedSpan.input).toBe('original');
    });

    it('should preserve original span properties not modified by formatter', async () => {
      const formatter: CustomSpanFormatter = span => ({
        ...span,
        input: 'modified',
      });

      const exporter = new TestExporter({ customSpanFormatter: formatter });
      const span = createMockSpan({
        id: 'my-id',
        traceId: 'my-trace',
        name: 'my-name',
        attributes: { key: 'value' },
        metadata: { meta: 'data' },
      });
      await exporter.exportTracingEvent(createTracingEvent(span));

      const exported = exporter.exportedEvents[0].exportedSpan;
      expect(exported.id).toBe('my-id');
      expect(exported.traceId).toBe('my-trace');
      expect(exported.name).toBe('my-name');
      expect(exported.attributes).toEqual({ key: 'value' });
      expect(exported.metadata).toEqual({ meta: 'data' });
      expect(exported.input).toBe('modified');
    });

    it('should apply async customSpanFormatter to exported spans', async () => {
      const asyncFormatter: CustomSpanFormatter = async span => {
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          ...span,
          input: 'async-formatted-input',
          output: 'async-formatted-output',
        };
      };

      const exporter = new TestExporter({ customSpanFormatter: asyncFormatter });
      const span = createMockSpan();
      const event = createTracingEvent(span);

      await exporter.exportTracingEvent(event);

      expect(exporter.exportedEvents).toHaveLength(1);
      expect(exporter.exportedEvents[0].exportedSpan.input).toBe('async-formatted-input');
      expect(exporter.exportedEvents[0].exportedSpan.output).toBe('async-formatted-output');
    });

    it('should handle async formatter errors gracefully and use original span', async () => {
      const errorAsyncFormatter: CustomSpanFormatter = async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        throw new Error('Async formatter error');
      };

      const logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const exporter = new TestExporter({
        customSpanFormatter: errorAsyncFormatter,
        logger: logger as any,
      });
      const span = createMockSpan({
        input: 'original-input',
      });
      const event = createTracingEvent(span);

      await exporter.exportTracingEvent(event);

      // Should use original span when async formatter throws
      expect(exporter.exportedEvents).toHaveLength(1);
      expect(exporter.exportedEvents[0].exportedSpan.input).toBe('original-input');
      // Should log the error
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error in customSpanFormatter'),
        expect.any(Object),
      );
    });

    it('should handle async formatter that rejects with original span', async () => {
      const rejectingFormatter: CustomSpanFormatter = () => {
        return Promise.reject(new Error('Rejected!'));
      };

      const logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const exporter = new TestExporter({
        customSpanFormatter: rejectingFormatter,
        logger: logger as any,
      });
      const span = createMockSpan({
        input: 'original-input',
      });

      await exporter.exportTracingEvent(createTracingEvent(span));

      expect(exporter.exportedEvents).toHaveLength(1);
      expect(exporter.exportedEvents[0].exportedSpan.input).toBe('original-input');
      expect(logger.error).toHaveBeenCalled();
    });
  });
});

describe('chainFormatters', () => {
  it('should chain multiple formatters in order', async () => {
    const formatter1: CustomSpanFormatter = span => ({
      ...span,
      input: `${span.input}-first`,
    });
    const formatter2: CustomSpanFormatter = span => ({
      ...span,
      input: `${span.input}-second`,
    });
    const formatter3: CustomSpanFormatter = span => ({
      ...span,
      input: `${span.input}-third`,
    });

    const chained = chainFormatters([formatter1, formatter2, formatter3]);
    const exporter = new TestExporter({ customSpanFormatter: chained });

    const span = createMockSpan({ input: 'start' });
    await exporter.exportTracingEvent(createTracingEvent(span));

    expect(exporter.exportedEvents[0].exportedSpan.input).toBe('start-first-second-third');
  });

  it('should handle empty formatter array', async () => {
    const chained = chainFormatters([]);
    const exporter = new TestExporter({ customSpanFormatter: chained });

    const span = createMockSpan({ input: 'original' });
    await exporter.exportTracingEvent(createTracingEvent(span));

    expect(exporter.exportedEvents[0].exportedSpan.input).toBe('original');
  });

  it('should handle single formatter', async () => {
    const formatter: CustomSpanFormatter = span => ({
      ...span,
      input: 'single',
    });

    const chained = chainFormatters([formatter]);
    const exporter = new TestExporter({ customSpanFormatter: chained });

    const span = createMockSpan({ input: 'original' });
    await exporter.exportTracingEvent(createTracingEvent(span));

    expect(exporter.exportedEvents[0].exportedSpan.input).toBe('single');
  });

  it('should allow different formatters to modify different fields', async () => {
    const inputFormatter: CustomSpanFormatter = span => ({
      ...span,
      input: 'formatted-input',
    });
    const outputFormatter: CustomSpanFormatter = span => ({
      ...span,
      output: 'formatted-output',
    });
    const nameFormatter: CustomSpanFormatter = span => ({
      ...span,
      name: 'formatted-name',
    });

    const chained = chainFormatters([inputFormatter, outputFormatter, nameFormatter]);
    const exporter = new TestExporter({ customSpanFormatter: chained });

    const span = createMockSpan({
      input: 'original-input',
      output: 'original-output',
      name: 'original-name',
    });
    await exporter.exportTracingEvent(createTracingEvent(span));

    const exported = exporter.exportedEvents[0].exportedSpan;
    expect(exported.input).toBe('formatted-input');
    expect(exported.output).toBe('formatted-output');
    expect(exported.name).toBe('formatted-name');
  });

  it('should chain async formatters in order', async () => {
    const asyncFormatter1: CustomSpanFormatter = async span => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return {
        ...span,
        input: `${span.input}-async1`,
      };
    };
    const asyncFormatter2: CustomSpanFormatter = async span => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return {
        ...span,
        input: `${span.input}-async2`,
      };
    };

    const chained = chainFormatters([asyncFormatter1, asyncFormatter2]);
    const exporter = new TestExporter({ customSpanFormatter: chained });

    const span = createMockSpan({ input: 'start' });
    await exporter.exportTracingEvent(createTracingEvent(span));

    expect(exporter.exportedEvents[0].exportedSpan.input).toBe('start-async1-async2');
  });

  it('should chain mixed sync and async formatters', async () => {
    const syncFormatter: CustomSpanFormatter = span => ({
      ...span,
      input: `${span.input}-sync`,
    });
    const asyncFormatter: CustomSpanFormatter = async span => {
      await new Promise(resolve => setTimeout(resolve, 5));
      return {
        ...span,
        input: `${span.input}-async`,
      };
    };
    const anotherSyncFormatter: CustomSpanFormatter = span => ({
      ...span,
      input: `${span.input}-sync2`,
    });

    const chained = chainFormatters([syncFormatter, asyncFormatter, anotherSyncFormatter]);
    const exporter = new TestExporter({ customSpanFormatter: chained });

    const span = createMockSpan({ input: 'start' });
    await exporter.exportTracingEvent(createTracingEvent(span));

    expect(exporter.exportedEvents[0].exportedSpan.input).toBe('start-sync-async-sync2');
  });

  it('should handle async formatter enrichment use case', async () => {
    // Simulate an async enrichment formatter that fetches external data
    const enrichmentFormatter: CustomSpanFormatter = async span => {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 10));
      // Simulate enriched data from external source
      const enrichedData = { userName: 'John Doe', department: 'Engineering' };
      return {
        ...span,
        metadata: { ...span.metadata, ...enrichedData },
      };
    };

    const exporter = new TestExporter({ customSpanFormatter: enrichmentFormatter });
    const span = createMockSpan({
      metadata: { userId: 'user-123' },
    });
    await exporter.exportTracingEvent(createTracingEvent(span));

    const exported = exporter.exportedEvents[0].exportedSpan;
    expect(exported.metadata).toEqual({
      userId: 'user-123',
      userName: 'John Doe',
      department: 'Engineering',
    });
  });
});
