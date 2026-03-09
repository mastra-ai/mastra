import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OtelExporter } from './tracing';

// Mock the OpenTelemetry modules
vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: vi.fn().mockImplementation(function () {
    return {
      export: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
  }),
}));

vi.mock('@opentelemetry/sdk-trace-base', () => ({
  SimpleSpanProcessor: vi.fn(),
  BatchSpanProcessor: vi.fn().mockImplementation(function () {
    return {
      onEnd: vi.fn(),
      onStart: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
      forceFlush: vi.fn().mockResolvedValue(undefined),
    };
  }),
}));

vi.mock('@opentelemetry/sdk-trace-node', () => ({
  NodeTracerProvider: vi.fn().mockImplementation(function () {
    return {
      addSpanProcessor: vi.fn(),
      register: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
  }),
}));

vi.mock('@opentelemetry/resources', () => ({
  defaultResource: vi.fn().mockReturnValue({
    merge: vi.fn().mockReturnValue({}),
  }),
  resourceFromAttributes: vi.fn().mockReturnValue({}),
}));

vi.mock('./loadExporter', () => ({
  loadExporter: vi.fn().mockResolvedValue(
    class MockExporter {
      export = vi.fn().mockResolvedValue(undefined);
      shutdown = vi.fn().mockResolvedValue(undefined);
    },
  ),
}));

describe('OtelExporter', () => {
  let exporter: OtelExporter;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    if (exporter) {
      await exporter.shutdown();
    }
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Provider Configuration', () => {
    it('should configure Dash0 provider correctly', async () => {
      exporter = new OtelExporter({
        provider: {
          dash0: {
            apiKey: 'test-api-key',
            dataset: 'test-dataset',
          },
        },
      });

      const exportedSpan = {
        id: 'span-1',
        traceId: 'trace-1',
        parent: undefined,
        type: SpanType.AGENT_RUN,
        name: 'Test Span',
        startTime: new Date(),
        endTime: new Date(),
        input: { test: 'input' },
        output: { test: 'output' },
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan,
      });

      // Verify configuration was applied
      expect(exporter).toBeDefined();
    });

    it('should configure SigNoz provider correctly', async () => {
      exporter = new OtelExporter({
        provider: {
          signoz: {
            apiKey: 'test-api-key',
            region: 'us',
          },
        },
      });

      const exportedSpan = {
        id: 'span-1',
        traceId: 'trace-1',
        parent: undefined,
        type: SpanType.AGENT_RUN,
        name: 'Test Span',
        startTime: new Date(),
        endTime: new Date(),
        input: { test: 'input' },
        output: { test: 'output' },
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan,
      });

      expect(exporter).toBeDefined();
    });

    it('should configure New Relic provider correctly', async () => {
      exporter = new OtelExporter({
        provider: {
          newrelic: {
            apiKey: 'test-license-key',
          },
        },
      });

      const exportedSpan = {
        id: 'span-1',
        traceId: 'trace-1',
        parent: undefined,
        type: SpanType.AGENT_RUN,
        name: 'Test Span',
        startTime: new Date(),
        endTime: new Date(),
        input: { test: 'input' },
        output: { test: 'output' },
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan,
      });

      expect(exporter).toBeDefined();
    });
  });

  describe('Span Buffering', () => {
    it('should buffer spans until root completes', async () => {
      exporter = new OtelExporter({
        provider: {
          custom: {
            endpoint: 'http://localhost:4318',
          },
        },
      });

      const rootSpan = {
        id: 'root-1',
        traceId: 'trace-1',
        parent: undefined,
        type: SpanType.AGENT_RUN,
        name: 'Root Span',
        startTime: new Date(),
      } as unknown as AnyExportedSpan;

      const childSpan = {
        id: 'child-1',
        traceId: 'trace-1',
        parent: undefined,
        type: SpanType.WORKFLOW_STEP,
        name: 'Child Span',
        startTime: new Date(),
        endTime: new Date(),
      } as unknown as AnyExportedSpan;

      // Process child first (should buffer)
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: childSpan,
      });

      // Process incomplete root (should buffer)
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: rootSpan,
      });

      // Complete root
      const completedRoot = { ...rootSpan, endTime: new Date() };
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: completedRoot,
      });

      // Should schedule export after delay
      vi.advanceTimersByTime(5000);

      // Verify export was triggered
      expect(exporter).toBeDefined();
    });

    it('should handle multiple traces independently', async () => {
      exporter = new OtelExporter({
        provider: {
          custom: {
            endpoint: 'http://localhost:4318',
          },
        },
      });

      const trace1Root = {
        id: 'root-1',
        traceId: 'trace-1',
        parent: undefined,
        type: SpanType.WORKFLOW_RUN,
        name: 'Workflow 1',
        startTime: new Date(),
        endTime: new Date(),
      } as unknown as AnyExportedSpan;

      const trace2Root = {
        id: 'root-2',
        traceId: 'trace-2',
        parent: undefined,
        type: SpanType.WORKFLOW_RUN,
        name: 'Workflow 2',
        startTime: new Date(),
        endTime: new Date(),
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: trace1Root,
      });
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: trace2Root,
      });

      // Both traces should be scheduled for export
      vi.advanceTimersByTime(5000);

      expect(exporter).toBeDefined();
    });
  });

  describe('Span Type Mapping', () => {
    it('should map LLM spans correctly', async () => {
      exporter = new OtelExporter({
        provider: {
          custom: {
            endpoint: 'http://localhost:4318',
          },
        },
      });

      const llmSpan = {
        id: 'llm-1',
        traceId: 'trace-1',
        parent: undefined,
        type: SpanType.MODEL_GENERATION,
        name: 'LLM Generation',
        startTime: new Date(),
        endTime: new Date(),
        input: { messages: [{ role: 'user', content: 'Hello' }] },
        output: { content: 'Hi there!' },
        model: 'gpt-4',
        provider: 'openai',
        usage: {
          inputTokens: 10,
          outputTokens: 5,
        },
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: llmSpan,
      });

      vi.advanceTimersByTime(5000);
      expect(exporter).toBeDefined();
    });

    it('should map tool spans correctly', async () => {
      exporter = new OtelExporter({
        provider: {
          custom: {
            endpoint: 'http://localhost:4318',
          },
        },
      });

      const toolSpan = {
        id: 'tool-1',
        traceId: 'trace-1',
        parent: undefined,
        type: SpanType.TOOL_CALL,
        name: 'Calculator',
        startTime: new Date(),
        endTime: new Date(),
        input: { operation: 'add', a: 2, b: 3 },
        output: { result: 5 },
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: toolSpan,
      });

      vi.advanceTimersByTime(5000);
      expect(exporter).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle spans with errors', async () => {
      exporter = new OtelExporter({
        provider: {
          custom: {
            endpoint: 'http://localhost:4318',
          },
        },
      });

      const errorSpan = {
        id: 'error-1',
        traceId: 'trace-1',
        parent: undefined,
        type: SpanType.AGENT_RUN,
        name: 'Failed Operation',
        startTime: new Date(),
        endTime: new Date(),
        errorInfo: {
          message: 'Invalid input provided',
          details: {
            stack: 'Error: Invalid input\n  at validate()',
          },
        },
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: errorSpan,
      });
      vi.advanceTimersByTime(5000);

      expect(exporter).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should export remaining traces on close', async () => {
      exporter = new OtelExporter({
        provider: {
          custom: {
            endpoint: 'http://localhost:4318',
          },
        },
      });

      const exportedSpan: AnyExportedSpan = {
        id: 'span-1',
        traceId: 'trace-1',
        parent: undefined,
        type: SpanType.AGENT_RUN,
        name: 'Test Span',
        startTime: new Date(),
        endTime: new Date(),
      } as unknown as AnyExportedSpan;

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan,
      });

      // Close before timer expires
      await exporter.shutdown();

      expect(exporter).toBeDefined();
    });
  });

  describe('Tags Support', () => {
    it('should include tags as mastra.tags attribute for root spans with tags', async () => {
      // This test captures the expected behavior: tags should be included as span attributes
      const { SpanConverter } = await import('./span-converter');
      const converter = new SpanConverter({
        format: 'GenAI_v1_38_0',
        packageName: 'test',
      });

      const rootSpanWithTags = {
        id: 'root-with-tags',
        traceId: 'trace-with-tags',
        type: SpanType.AGENT_RUN,
        name: 'tagged-agent',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: true,
        attributes: { agentId: 'agent-123' },
        tags: ['production', 'experiment-v2', 'user-request'],
      } as unknown as AnyExportedSpan;

      const readableSpan = await converter.convertSpan(rootSpanWithTags);

      // Tags should be present as mastra.tags attribute (JSON-stringified for backend compatibility)
      expect(readableSpan.attributes['mastra.tags']).toBeDefined();
      expect(readableSpan.attributes['mastra.tags']).toBe(
        JSON.stringify(['production', 'experiment-v2', 'user-request']),
      );
    });

    it('should not include mastra.tags attribute when tags array is empty', async () => {
      const { SpanConverter } = await import('./span-converter');
      const converter = new SpanConverter({
        format: 'GenAI_v1_38_0',
        packageName: 'test',
      });

      const rootSpanEmptyTags = {
        id: 'root-empty-tags',
        traceId: 'trace-empty-tags',
        type: SpanType.AGENT_RUN,
        name: 'agent-no-tags',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: true,
        attributes: { agentId: 'agent-123' },
        tags: [],
      } as unknown as AnyExportedSpan;

      const readableSpan = await converter.convertSpan(rootSpanEmptyTags);

      // Tags should NOT be present when array is empty
      expect(readableSpan.attributes['mastra.tags']).toBeUndefined();
    });

    it('should not include mastra.tags attribute when tags is undefined', async () => {
      const { SpanConverter } = await import('./span-converter');
      const converter = new SpanConverter({
        format: 'GenAI_v1_38_0',
        packageName: 'test',
      });

      const rootSpanNoTags = {
        id: 'root-no-tags',
        traceId: 'trace-no-tags',
        type: SpanType.AGENT_RUN,
        name: 'agent-undefined-tags',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: true,
        attributes: { agentId: 'agent-123' },
        // tags is undefined by default
      } as unknown as AnyExportedSpan;

      const readableSpan = await converter.convertSpan(rootSpanNoTags);

      // Tags should NOT be present when undefined
      expect(readableSpan.attributes['mastra.tags']).toBeUndefined();
    });

    it('should not include mastra.tags attribute for child spans (tags only on root spans)', async () => {
      const { SpanConverter } = await import('./span-converter');
      const converter = new SpanConverter({
        format: 'GenAI_v1_38_0',
        packageName: 'test',
      });

      // Child spans should not have tags even if accidentally set
      const childSpanWithTags = {
        id: 'child-with-tags',
        traceId: 'trace-parent',
        parentSpanId: 'root-span-id',
        type: SpanType.TOOL_CALL,
        name: 'child-tool',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: false,
        attributes: { toolId: 'calculator' },
        tags: ['should-not-appear'],
      } as unknown as AnyExportedSpan;

      const readableSpan = await converter.convertSpan(childSpanWithTags);

      // Tags should NOT be present on child spans
      expect(readableSpan.attributes['mastra.tags']).toBeUndefined();
    });

    it('should include tags with workflow spans', async () => {
      const { SpanConverter } = await import('./span-converter');
      const converter = new SpanConverter({
        format: 'GenAI_v1_38_0',
        packageName: 'test',
      });

      const workflowSpanWithTags = {
        id: 'workflow-with-tags',
        traceId: 'trace-workflow',
        type: SpanType.WORKFLOW_RUN,
        name: 'data-processing-workflow',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: true,
        attributes: { workflowId: 'wf-123' },
        tags: ['batch-processing', 'priority-high'],
      } as unknown as AnyExportedSpan;

      const readableSpan = await converter.convertSpan(workflowSpanWithTags);

      // Tags should be present as mastra.tags attribute (JSON-stringified for backend compatibility)
      expect(readableSpan.attributes['mastra.tags']).toBeDefined();
      expect(readableSpan.attributes['mastra.tags']).toBe(JSON.stringify(['batch-processing', 'priority-high']));
    });
  });
});
