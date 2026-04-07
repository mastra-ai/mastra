import { SpanType, SamplingStrategyType } from '@mastra/core/observability';
import type { TracingEvent, ObservabilityExporter, AnyExportedSpan } from '@mastra/core/observability';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultObservabilityInstance } from './instances';

// Mock console to avoid noise in test output
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};
vi.stubGlobal('console', mockConsole);

afterAll(() => {
  vi.unstubAllGlobals();
});

// Test exporter for capturing events
class TestExporter implements ObservabilityExporter {
  name = 'test-exporter';
  events: TracingEvent[] = [];

  async exportTracingEvent(event: TracingEvent): Promise<void> {
    this.events.push(event);
  }

  async shutdown(): Promise<void> {}
  async flush(): Promise<void> {}

  reset(): void {
    this.events = [];
  }
}

describe('Span Filtering', () => {
  let testExporter: TestExporter;

  beforeEach(() => {
    vi.resetAllMocks();
    testExporter = new TestExporter();
  });

  describe('excludeSpanTypes', () => {
    it('should exclude spans of specified types from export', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
        excludeSpanTypes: [SpanType.MODEL_CHUNK, SpanType.MODEL_STEP],
      });

      // Create an agent span (not excluded)
      const agentSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
      });

      // Create a model generation span (not excluded)
      const modelSpan = agentSpan.createChildSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'test-model',
        attributes: { model: 'gpt-4', provider: 'openai' },
      });

      // Create MODEL_STEP span (excluded)
      const stepSpan = modelSpan.createChildSpan({
        type: SpanType.MODEL_STEP,
        name: 'test-step',
      });

      // End spans in reverse order
      stepSpan.end();
      modelSpan.end();
      agentSpan.end();

      // Should have events for agent and model spans only (started + ended each)
      const spanTypes = testExporter.events.map(e => e.exportedSpan.type);
      expect(spanTypes).not.toContain(SpanType.MODEL_STEP);
      expect(spanTypes).not.toContain(SpanType.MODEL_CHUNK);
      expect(spanTypes).toContain(SpanType.AGENT_RUN);
      expect(spanTypes).toContain(SpanType.MODEL_GENERATION);
    });

    it('should export all spans when excludeSpanTypes is empty', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
        excludeSpanTypes: [],
      });

      const span = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
      });
      span.end();

      const spanTypes = testExporter.events.map(e => e.exportedSpan.type);
      expect(spanTypes).toContain(SpanType.AGENT_RUN);
    });

    it('should export all spans when excludeSpanTypes is not set', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
      });

      const span = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
      });
      span.end();

      expect(testExporter.events.length).toBeGreaterThan(0);
    });
  });

  describe('spanFilter', () => {
    it('should drop spans when filter returns false', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
        spanFilter: (span: AnyExportedSpan) => {
          return span.type !== SpanType.TOOL_CALL;
        },
      });

      const agentSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
      });

      const toolSpan = agentSpan.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'test-tool',
      });

      toolSpan.end();
      agentSpan.end();

      const spanTypes = testExporter.events.map(e => e.exportedSpan.type);
      expect(spanTypes).not.toContain(SpanType.TOOL_CALL);
      expect(spanTypes).toContain(SpanType.AGENT_RUN);
    });

    it('should keep spans when filter returns true', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
        spanFilter: () => true,
      });

      const span = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
      });
      span.end();

      expect(testExporter.events.length).toBe(2); // started + ended
    });

    it('should filter by span attributes', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
        spanFilter: (span: AnyExportedSpan) => {
          // Only keep tool calls that failed
          if (span.type === SpanType.TOOL_CALL) {
            return (span.attributes as any)?.success === false;
          }
          return true;
        },
      });

      const agentSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
      });

      // Successful tool call - should be filtered out
      const successTool = agentSpan.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'success-tool',
        attributes: { success: true },
      });
      successTool.end();

      // Failed tool call - should be kept
      const failedTool = agentSpan.createChildSpan({
        type: SpanType.TOOL_CALL,
        name: 'failed-tool',
        attributes: { success: false },
      });
      failedTool.end();

      agentSpan.end();

      const toolEvents = testExporter.events.filter(e => e.exportedSpan.type === SpanType.TOOL_CALL);
      const toolNames = toolEvents.map(e => e.exportedSpan.name);
      expect(toolNames).toContain('failed-tool');
      expect(toolNames).not.toContain('success-tool');
    });

    it('should keep spans when filter throws an error', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
        spanFilter: () => {
          throw new Error('filter crashed');
        },
      });

      const span = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
      });
      span.end();

      // Span should still be exported despite filter error
      expect(testExporter.events.length).toBe(2); // started + ended
    });

    it('should filter by metadata', () => {
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
        spanFilter: (span: AnyExportedSpan) => {
          // Only export spans tagged for production
          return span.metadata?.environment === 'production';
        },
      });

      const prodSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'prod-agent',
        metadata: { environment: 'production' },
      });
      prodSpan.end();

      const devSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'dev-agent',
        metadata: { environment: 'development' },
      });
      devSpan.end();

      const spanNames = testExporter.events.map(e => e.exportedSpan.name);
      expect(spanNames).toContain('prod-agent');
      expect(spanNames).not.toContain('dev-agent');
    });
  });

  describe('excludeSpanTypes + spanFilter combined', () => {
    it('should apply excludeSpanTypes first, then spanFilter', () => {
      const filterCalls: string[] = [];

      const tracing = new DefaultObservabilityInstance({
        serviceName: 'test',
        name: 'test-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        exporters: [testExporter],
        excludeSpanTypes: [SpanType.MODEL_CHUNK],
        spanFilter: (span: AnyExportedSpan) => {
          filterCalls.push(span.type);
          // Also filter out workflow sleep spans
          return span.type !== SpanType.WORKFLOW_SLEEP;
        },
      });

      const agentSpan = tracing.startSpan({
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
      });

      // MODEL_CHUNK - should be excluded by excludeSpanTypes (never reaches spanFilter)
      const chunkSpan = agentSpan.createChildSpan({
        type: SpanType.MODEL_CHUNK,
        name: 'test-chunk',
      });
      chunkSpan.end();

      agentSpan.end();

      // MODEL_CHUNK should never reach the spanFilter
      expect(filterCalls).not.toContain(SpanType.MODEL_CHUNK);

      // Only AGENT_RUN events should be exported
      const spanTypes = testExporter.events.map(e => e.exportedSpan.type);
      expect(spanTypes).not.toContain(SpanType.MODEL_CHUNK);
    });
  });
});
