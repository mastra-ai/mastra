import { AISpanType, AITracingEventType } from '@mastra/core/ai-tracing';
import type { AnyExportedAISpan } from '@mastra/core/ai-tracing';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { OtelBridge } from './otel-bridge';

// Mock tracer and spans
const mockSpans: Map<string, any> = new Map();

const createMockSpan = (spanId: string): Span => {
  const span = {
    spanContext: () => ({
      traceId: 'test-trace-id',
      spanId,
      traceFlags: 0x01, // Sampled
      isRemote: false,
    }),
    setAttributes: vi.fn(),
    setAttribute: vi.fn(),
    setStatus: vi.fn(),
    recordException: vi.fn(),
    end: vi.fn(),
    isRecording: () => true,
    updateName: vi.fn(),
    addEvent: vi.fn(),
    addLink: vi.fn(),
    addLinks: vi.fn(),
  };

  mockSpans.set(spanId, span);
  return span as unknown as Span;
};

const mockTracer = {
  startSpan: vi.fn((name, options, ctx) => {
    const spanId = `span-${mockSpans.size + 1}`;
    return createMockSpan(spanId);
  }),
};

// Mock @opentelemetry/api
vi.mock('@opentelemetry/api', async () => {
  const actual = await vi.importActual('@opentelemetry/api');
  return {
    ...actual,
    trace: {
      getTracer: vi.fn(() => mockTracer),
      getSpanContext: vi.fn(() => undefined),
      setSpan: vi.fn((ctx, span) => ctx),
    },
    context: {
      active: vi.fn(() => ({})),
    },
  };
});

describe('OtelBridge', () => {
  let bridge: OtelBridge;

  beforeEach(() => {
    mockSpans.clear();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (bridge) {
      await bridge.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      bridge = new OtelBridge();

      expect(bridge.name).toBe('otel-bridge');
    });

    it('should initialize with custom config', () => {
      bridge = new OtelBridge({
        tracerName: 'custom-tracer',
        tracerVersion: '2.0.0',
        attributePrefix: 'custom.',
        forceExport: true,
        logLevel: 'debug',
      });

      expect(bridge.name).toBe('otel-bridge');
    });

    it('should accept tracing config via init()', () => {
      bridge = new OtelBridge();

      bridge.init({
        name: 'test-tracing',
        serviceName: 'test-service',
      });

      expect(bridge).toBeDefined();
    });
  });

  describe('Span Lifecycle - Started Event', () => {
    beforeEach(() => {
      bridge = new OtelBridge();
    });

    it('should create OTEL span when Mastra span starts', async () => {
      const mastraSpan: AnyExportedAISpan = {
        id: 'mastra-span-1',
        traceId: 'trace-1',
        name: 'Test Agent',
        type: AISpanType.AGENT_RUN,
        startTime: new Date(),
        isRootSpan: true,
        isEvent: false,
        attributes: {
          agentId: 'test-agent',
          model: 'gpt-4',
          provider: 'openai',
        },
      } as AnyExportedAISpan;

      await bridge.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        exportedSpan: mastraSpan,
      });

      // Verify tracer.startSpan was called
      expect(mockTracer.startSpan).toHaveBeenCalledTimes(1);

      const [spanName, options, ctx] = mockTracer.startSpan.mock.calls[0];
      expect(spanName).toBe('agent.test-agent');
      expect(options.kind).toBeDefined();
    });

    it('should set attributes on span start', async () => {
      const mastraSpan: AnyExportedAISpan = {
        id: 'mastra-span-1',
        traceId: 'trace-1',
        name: 'LLM Call',
        type: AISpanType.LLM_GENERATION,
        startTime: new Date(),
        isRootSpan: false,
        isEvent: false,
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
          },
        },
        input: 'Test prompt',
        output: 'Test response',
      } as AnyExportedAISpan;

      await bridge.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        exportedSpan: mastraSpan,
      });

      // Get the mock span that was created
      const mockSpan = Array.from(mockSpans.values())[0];

      // Verify attributes were set
      expect(mockSpan.setAttributes).toHaveBeenCalled();

      const attributes = mockSpan.setAttributes.mock.calls[0][0];
      expect(attributes).toMatchObject({
        'gen_ai.request.model': 'gpt-4',
        'gen_ai.system': 'openai',
        'gen_ai.usage.input_tokens': 100,
        'gen_ai.usage.output_tokens': 50,
        'gen_ai.usage.total_tokens': 150,
        'mastra.span.type': AISpanType.LLM_GENERATION,
        'mastra.trace_id': 'trace-1',
        'mastra.span_id': 'mastra-span-1',
      });
    });

    it('should handle parent-child span relationships', async () => {
      const parentSpan: AnyExportedAISpan = {
        id: 'parent-span',
        traceId: 'trace-1',
        name: 'Parent',
        type: AISpanType.AGENT_RUN,
        startTime: new Date(),
        isRootSpan: true,
        isEvent: false,
      } as AnyExportedAISpan;

      const childSpan: AnyExportedAISpan = {
        id: 'child-span',
        traceId: 'trace-1',
        parentSpanId: 'parent-span',
        name: 'Child',
        type: AISpanType.TOOL_CALL,
        startTime: new Date(),
        isRootSpan: false,
        isEvent: false,
        attributes: {
          toolId: 'test-tool',
        },
      } as AnyExportedAISpan;

      // Start parent
      await bridge.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        exportedSpan: parentSpan,
      });

      // Start child
      await bridge.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        exportedSpan: childSpan,
      });

      // Both spans should be created
      expect(mockTracer.startSpan).toHaveBeenCalledTimes(2);
    });
  });

  describe('Span Lifecycle - Updated Event', () => {
    beforeEach(() => {
      bridge = new OtelBridge();
    });

    it('should update OTEL span attributes on Mastra span update', async () => {
      const initialSpan: AnyExportedAISpan = {
        id: 'mastra-span-1',
        traceId: 'trace-1',
        name: 'Test',
        type: AISpanType.LLM_GENERATION,
        startTime: new Date(),
        isRootSpan: true,
        isEvent: false,
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
        },
      } as AnyExportedAISpan;

      // Start the span
      await bridge.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        exportedSpan: initialSpan,
      });

      const mockSpan = Array.from(mockSpans.values())[0];
      mockSpan.setAttributes.mockClear();

      // Update the span with usage info
      const updatedSpan: AnyExportedAISpan = {
        ...initialSpan,
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          usage: {
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
          },
        },
      } as AnyExportedAISpan;

      await bridge.exportEvent({
        type: AITracingEventType.SPAN_UPDATED,
        exportedSpan: updatedSpan,
      });

      // Verify attributes were updated
      expect(mockSpan.setAttributes).toHaveBeenCalled();

      const attributes = mockSpan.setAttributes.mock.calls[0][0];
      expect(attributes).toMatchObject({
        'gen_ai.usage.input_tokens': 100,
        'gen_ai.usage.output_tokens': 50,
      });
    });
  });

  describe('Span Lifecycle - Ended Event', () => {
    beforeEach(() => {
      bridge = new OtelBridge();
    });

    it('should end OTEL span when Mastra span ends successfully', async () => {
      const startedSpan: AnyExportedAISpan = {
        id: 'mastra-span-1',
        traceId: 'trace-1',
        name: 'Test',
        type: AISpanType.AGENT_RUN,
        startTime: new Date(),
        isRootSpan: true,
        isEvent: false,
      } as AnyExportedAISpan;

      await bridge.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        exportedSpan: startedSpan,
      });

      const mockSpan = Array.from(mockSpans.values())[0];

      const endedSpan: AnyExportedAISpan = {
        ...startedSpan,
        endTime: new Date(),
      } as AnyExportedAISpan;

      await bridge.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        exportedSpan: endedSpan,
      });

      // Verify span.end was called
      expect(mockSpan.end).toHaveBeenCalled();

      // Verify status was set to OK
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.OK,
      });
    });

    it('should set error status when Mastra span ends with error', async () => {
      const startedSpan: AnyExportedAISpan = {
        id: 'mastra-span-1',
        traceId: 'trace-1',
        name: 'Test',
        type: AISpanType.AGENT_RUN,
        startTime: new Date(),
        isRootSpan: true,
        isEvent: false,
      } as AnyExportedAISpan;

      await bridge.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        exportedSpan: startedSpan,
      });

      const mockSpan = Array.from(mockSpans.values())[0];

      const endedSpan: AnyExportedAISpan = {
        ...startedSpan,
        endTime: new Date(),
        errorInfo: {
          message: 'Test error',
          id: 'error-1',
        },
      } as AnyExportedAISpan;

      await bridge.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        exportedSpan: endedSpan,
      });

      // Verify error status was set
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'Test error',
      });

      // Verify exception was recorded
      expect(mockSpan.recordException).toHaveBeenCalledWith({
        name: 'Error',
        message: 'Test error',
        stack: undefined,
      });
    });

    it('should clean up completed traces', async () => {
      const span1: AnyExportedAISpan = {
        id: 'span-1',
        traceId: 'trace-1',
        name: 'Span 1',
        type: AISpanType.AGENT_RUN,
        startTime: new Date(),
        isRootSpan: true,
        isEvent: false,
      } as AnyExportedAISpan;

      const span2: AnyExportedAISpan = {
        id: 'span-2',
        traceId: 'trace-1',
        parentSpanId: 'span-1',
        name: 'Span 2',
        type: AISpanType.TOOL_CALL,
        startTime: new Date(),
        isRootSpan: false,
        isEvent: false,
      } as AnyExportedAISpan;

      // Start both spans
      await bridge.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        exportedSpan: span1,
      });

      await bridge.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        exportedSpan: span2,
      });

      // End both spans
      await bridge.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        exportedSpan: { ...span2, endTime: new Date() } as AnyExportedAISpan,
      });

      await bridge.exportEvent({
        type: AITracingEventType.SPAN_ENDED,
        exportedSpan: { ...span1, endTime: new Date() } as AnyExportedAISpan,
      });

      // Trace should be cleaned up (we can't directly verify the internal state,
      // but we can verify that both spans were ended)
      expect(mockTracer.startSpan).toHaveBeenCalledTimes(2);

      const allMockSpans = Array.from(mockSpans.values());
      expect(allMockSpans[0].end).toHaveBeenCalled();
      expect(allMockSpans[1].end).toHaveBeenCalled();
    });
  });

  describe('Sampling', () => {
    it('should respect OTEL sampling decision when not sampled', async () => {
      // Mock context to return a non-sampled span context
      vi.mocked(trace.getSpanContext).mockReturnValue({
        traceId: 'test-trace-id',
        spanId: 'test-span-id',
        traceFlags: 0x00, // Not sampled
        isRemote: false,
      });

      bridge = new OtelBridge({ forceExport: false });

      const mastraSpan: AnyExportedAISpan = {
        id: 'mastra-span-1',
        traceId: 'trace-1',
        name: 'Test',
        type: AISpanType.AGENT_RUN,
        startTime: new Date(),
        isRootSpan: true,
        isEvent: false,
      } as AnyExportedAISpan;

      await bridge.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        exportedSpan: mastraSpan,
      });

      // Span should not be created
      expect(mockTracer.startSpan).not.toHaveBeenCalled();
    });

    it('should force export when forceExport is true even if not sampled', async () => {
      // Mock context to return a non-sampled span context
      vi.mocked(trace.getSpanContext).mockReturnValue({
        traceId: 'test-trace-id',
        spanId: 'test-span-id',
        traceFlags: 0x00, // Not sampled
        isRemote: false,
      });

      bridge = new OtelBridge({ forceExport: true });

      const mastraSpan: AnyExportedAISpan = {
        id: 'mastra-span-1',
        traceId: 'trace-1',
        name: 'Test',
        type: AISpanType.AGENT_RUN,
        startTime: new Date(),
        isRootSpan: true,
        isEvent: false,
      } as AnyExportedAISpan;

      await bridge.exportEvent({
        type: AITracingEventType.SPAN_STARTED,
        exportedSpan: mastraSpan,
      });

      // Span should be created because forceExport is true
      expect(mockTracer.startSpan).toHaveBeenCalled();
    });
  });

  describe('Shutdown', () => {
    it('should shutdown cleanly', async () => {
      bridge = new OtelBridge();

      // Simple shutdown test - verify no errors thrown
      await expect(bridge.shutdown()).resolves.not.toThrow();
    });
  });
});
