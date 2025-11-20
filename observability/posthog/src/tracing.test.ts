import { SpanType, TracingEventType } from '@mastra/core/observability';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { PosthogExporter } from './tracing';

// Mock PostHog client
const mockCapture = vi.fn();
const mockShutdown = vi.fn();
const mockPostHogConstructor = vi.fn();

vi.mock('posthog-node', () => {
  return {
    PostHog: class {
      constructor(...args: any[]) {
        mockPostHogConstructor(...args);
      }
      capture = mockCapture;
      shutdown = mockShutdown;
    },
  };
});

describe('PosthogExporter', () => {
  let exporter: PosthogExporter;
  const validConfig = { apiKey: 'test-key' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (exporter) {
      await exporter.shutdown();
    }
  });

  // --- Initialization Tests ---
  describe('Initialization', () => {
    it('should initialize with valid config', () => {
      exporter = new PosthogExporter(validConfig);
      expect(mockPostHogConstructor).toHaveBeenCalledWith(
        'test-key',
        expect.objectContaining({
          host: 'https://us.i.posthog.com',
          flushAt: 20,
          flushInterval: 10000,
        }),
      );
    });

    it('should disable when missing API key', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      exporter = new PosthogExporter({ apiKey: '' });
      expect(mockPostHogConstructor).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should use custom host if provided', () => {
      exporter = new PosthogExporter({ ...validConfig, host: 'https://eu.i.posthog.com' });
      expect(mockPostHogConstructor).toHaveBeenCalledWith(
        'test-key',
        expect.objectContaining({
          host: 'https://eu.i.posthog.com',
        }),
      );
    });

    it('should auto-configure serverless defaults', () => {
      exporter = new PosthogExporter({ ...validConfig, serverless: true });
      expect(mockPostHogConstructor).toHaveBeenCalledWith(
        'test-key',
        expect.objectContaining({
          flushAt: 10,
          flushInterval: 2000,
        }),
      );
    });

    it('should allow manual overrides in serverless mode', () => {
      exporter = new PosthogExporter({
        ...validConfig,
        serverless: true,
        flushAt: 50,
      });
      expect(mockPostHogConstructor).toHaveBeenCalledWith(
        'test-key',
        expect.objectContaining({
          flushAt: 50,
          flushInterval: 2000,
        }),
      );
    });
  });

  // --- Span Lifecycle Tests ---
  describe('Span Lifecycle', () => {
    const mockSpan = {
      id: 'span-1',
      traceId: 'trace-1',
      type: SpanType.GENERIC,
      name: 'test-span',
      startTime: Date.now(),
      endTime: Date.now() + 100, // 100ms duration
      attributes: {},
      metadata: {},
    };

    it('should cache span on start', async () => {
      exporter = new PosthogExporter(validConfig);

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: mockSpan as any,
      });

      // Access private traceMap for verification (casting to any)
      const traceMap = (exporter as any).traceMap;
      expect(traceMap.has(mockSpan.traceId)).toBe(true);
      const traceData = traceMap.get(mockSpan.traceId);
      expect(traceData.spans.has(mockSpan.id)).toBe(true);
    });

    it('should capture event on end', async () => {
      exporter = new PosthogExporter(validConfig);

      // Start
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: mockSpan as any,
      });

      // End
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan as any,
      });

      expect(mockCapture).toHaveBeenCalledTimes(1);
      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          event: '$ai_span',
          distinctId: 'anonymous',
          properties: expect.objectContaining({
            $ai_trace_id: mockSpan.traceId,
            $ai_span_id: mockSpan.id,
            $ai_latency: expect.closeTo(0.1, 1), // ~0.1s
          }),
        }),
      );
    });

    it('should cleanup span from cache after capture', async () => {
      exporter = new PosthogExporter(validConfig);

      // Start
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: mockSpan as any,
      });

      // End
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan as any,
      });

      const traceMap = (exporter as any).traceMap;
      // Trace should be gone if it was the only span
      expect(traceMap.has(mockSpan.traceId)).toBe(false);
    });

    it('should handle missing start event gracefully', async () => {
      exporter = new PosthogExporter(validConfig);
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Only End
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan as any,
      });

      expect(mockCapture).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // --- Distinct ID Resolution Tests ---
  describe('Distinct ID Resolution', () => {
    it('should use userId from metadata if present', async () => {
      exporter = new PosthogExporter(validConfig);
      const spanWithUser = {
        ...{
          id: 'span-user',
          traceId: 'trace-user',
          type: SpanType.GENERIC,
          name: 'user-span',
          startTime: Date.now(),
          endTime: Date.now() + 100,
          attributes: {},
        },
        metadata: { userId: 'user-123' },
      };

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: spanWithUser as any,
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: spanWithUser as any,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          distinctId: 'user-123',
        }),
      );
    });

    it('should use configured defaultDistinctId', async () => {
      exporter = new PosthogExporter({ ...validConfig, defaultDistinctId: 'system' });
      const spanNoUser = {
        id: 'span-anon',
        traceId: 'trace-anon',
        type: SpanType.GENERIC,
        name: 'anon-span',
        startTime: Date.now(),
        endTime: Date.now() + 100,
        attributes: {},
        metadata: {},
      };

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: spanNoUser as any,
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: spanNoUser as any,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          distinctId: 'system',
        }),
      );
    });
  });

  // --- Cleanup Tests ---
  describe('Cleanup', () => {
    it('should clear resources on shutdown', async () => {
      exporter = new PosthogExporter(validConfig);

      // Add some data
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: {
          id: 's1',
          traceId: 't1',
          startTime: Date.now(),
          type: SpanType.GENERIC,
        } as any,
      });

      await exporter.shutdown();

      expect(mockShutdown).toHaveBeenCalled();
      const traceMap = (exporter as any).traceMap;
      expect(traceMap.size).toBe(0);
    });
  });

  // --- Priority 1: Core Functionality ---
  describe('Span Type Mapping', () => {
    beforeEach(() => {
      exporter = new PosthogExporter(validConfig);
    });

    it('should map MODEL_GENERATION to $ai_generation', async () => {
      const generation = createSpan({ type: SpanType.MODEL_GENERATION });
      await exportSpanLifecycle(exporter, generation);

      expect(mockCapture).toHaveBeenCalledWith(expect.objectContaining({ event: '$ai_generation' }));
    });

    it('should map MODEL_STEP to $ai_generation', async () => {
      const step = createSpan({ type: SpanType.MODEL_STEP });
      await exportSpanLifecycle(exporter, step);

      expect(mockCapture).toHaveBeenCalledWith(expect.objectContaining({ event: '$ai_generation' }));
    });

    it('should map MODEL_CHUNK to $ai_span with chunk attributes', async () => {
      const chunk = createSpan({
        type: SpanType.MODEL_CHUNK,
        attributes: { chunkType: 'text', sequenceNumber: 5 },
      });
      await exportSpanLifecycle(exporter, chunk);

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          event: '$ai_span',
          properties: expect.objectContaining({
            chunk_type: 'text',
            chunk_sequence_number: 5,
          }),
        }),
      );
    });

    it('should map TOOL_CALL and other types to $ai_span', async () => {
      const toolSpan = createSpan({ type: SpanType.TOOL_CALL });
      await exportSpanLifecycle(exporter, toolSpan);

      expect(mockCapture).toHaveBeenCalledWith(expect.objectContaining({ event: '$ai_span' }));
    });
  });

  describe('LLM Generation Properties', () => {
    beforeEach(() => {
      exporter = new PosthogExporter(validConfig);
    });

    it('should extract model, provider, and tokens from attributes', async () => {
      const generation = createSpan({
        type: SpanType.MODEL_GENERATION,
        attributes: {
          model: 'gpt-4o',
          provider: 'openai',
          usage: {
            inputTokens: 100,
            outputTokens: 200,
            totalTokens: 300,
          },
        },
      });

      await exportSpanLifecycle(exporter, generation);

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            $ai_model: 'gpt-4o',
            $ai_provider: 'openai',
            $ai_input_tokens: 100,
            $ai_output_tokens: 200,
            $ai_total_tokens: 300,
          }),
        }),
      );
    });

    it('should handle minimal LLM attributes gracefully', async () => {
      const generation = createSpan({
        type: SpanType.MODEL_GENERATION,
        attributes: { model: 'gpt-3.5-turbo' },
      });

      await exportSpanLifecycle(exporter, generation);

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            $ai_model: 'gpt-3.5-turbo',
          }),
        }),
      );

      const props = mockCapture.mock.calls[0][0].properties;
      expect(props).not.toHaveProperty('$ai_input_tokens');
    });
  });

  describe('Span Hierarchy', () => {
    beforeEach(() => {
      exporter = new PosthogExporter(validConfig);
    });

    it('should set $ai_parent_id for child spans', async () => {
      const parent = createSpan({
        id: 'parent',
        traceId: 't1',
        type: SpanType.AGENT_RUN,
      });
      const child = createSpan({
        id: 'child',
        traceId: 't1',
        parentSpanId: 'parent',
        type: SpanType.TOOL_CALL,
      });

      await exportSpanLifecycle(exporter, parent);
      await exportSpanLifecycle(exporter, child);

      // Child should have parent_id
      expect(mockCapture).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          properties: expect.objectContaining({
            $ai_parent_id: 'parent',
            $ai_trace_id: 't1',
          }),
        }),
      );
    });

    it('should omit $ai_parent_id for root spans', async () => {
      const root = createSpan({ parentSpanId: undefined });
      await exportSpanLifecycle(exporter, root);

      const props = mockCapture.mock.calls[0][0].properties;
      expect(props).not.toHaveProperty('$ai_parent_id');
    });
  });

  // --- Priority 2: Advanced Features ---
  describe('Token Usage Normalization', () => {
    beforeEach(() => {
      exporter = new PosthogExporter(validConfig);
    });

    it('should normalize v4 format (promptTokens/completionTokens)', async () => {
      const generation = createSpan({
        type: SpanType.MODEL_GENERATION,
        attributes: {
          usage: {
            promptTokens: 100,
            completionTokens: 200,
            totalTokens: 300,
          },
        },
      });

      await exportSpanLifecycle(exporter, generation);

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            $ai_input_tokens: 100,
            $ai_output_tokens: 200,
            $ai_total_tokens: 300,
          }),
        }),
      );
    });

    it('should prefer v5 format (inputTokens/outputTokens) when both present', async () => {
      const generation = createSpan({
        type: SpanType.MODEL_GENERATION,
        attributes: {
          usage: {
            inputTokens: 150,
            outputTokens: 250,
            promptTokens: 100,
            completionTokens: 200,
            totalTokens: 400,
          },
        },
      });

      await exportSpanLifecycle(exporter, generation);

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            $ai_input_tokens: 150,
            $ai_output_tokens: 250,
          }),
        }),
      );
    });
  });

  describe('Privacy Mode', () => {
    it('should exclude input/output when privacy mode enabled', async () => {
      exporter = new PosthogExporter({
        ...validConfig,
        enablePrivacyMode: true,
      });

      const generation = createSpan({
        type: SpanType.MODEL_GENERATION,
        input: 'Sensitive user data',
        output: 'Generated response',
        attributes: {
          model: 'gpt-4',
          usage: { inputTokens: 10, outputTokens: 20 },
        },
      });

      await exportSpanLifecycle(exporter, generation);

      const props = mockCapture.mock.calls[0][0].properties;
      expect(props).not.toHaveProperty('$ai_input');
      expect(props).not.toHaveProperty('$ai_output_choices');

      // But should still have metadata
      expect(props).toHaveProperty('$ai_model');
      expect(props).toHaveProperty('$ai_input_tokens');
    });

    it('should not apply privacy mode to non-generation spans', async () => {
      exporter = new PosthogExporter({
        ...validConfig,
        enablePrivacyMode: true,
      });

      const toolSpan = createSpan({
        type: SpanType.TOOL_CALL,
        input: { param: 'value' },
        output: { result: 'data' },
      });

      await exportSpanLifecycle(exporter, toolSpan);

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            $ai_input_state: { param: 'value' },
            $ai_output_state: { result: 'data' },
          }),
        }),
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      exporter = new PosthogExporter(validConfig);
    });

    it('should include error details in properties', async () => {
      const errorSpan = createSpan({
        type: SpanType.TOOL_CALL,
        errorInfo: {
          message: 'Tool execution failed',
          id: 'TOOL_ERROR',
          category: 'EXECUTION',
        },
      });

      await exportSpanLifecycle(exporter, errorSpan);

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            $ai_is_error: true,
            error_message: 'Tool execution failed',
            error_id: 'TOOL_ERROR',
            error_category: 'EXECUTION',
          }),
        }),
      );
    });

    it('should handle capture errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockCapture
        .mockImplementationOnce(() => {
          throw new Error('Network error');
        })
        .mockImplementationOnce(() => {
          throw new Error('Network error');
        });

      const span = createSpan({ type: SpanType.GENERIC });

      await expect(exportSpanLifecycle(exporter, span)).resolves.not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  // --- Priority 3: Edge Cases ---
  describe('Event Span Handling', () => {
    beforeEach(() => {
      exporter = new PosthogExporter(validConfig);
    });

    it('should capture event spans immediately', async () => {
      const eventSpan = createSpan({
        id: 'event-1',
        type: SpanType.GENERIC,
        isEvent: true,
        output: { feedback: 'Great!' },
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: eventSpan as any,
      });

      expect(mockCapture).toHaveBeenCalledTimes(1);
      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            $ai_latency: 0,
          }),
        }),
      );
    });

    it('should not cache event spans', async () => {
      const eventSpan = createSpan({ isEvent: true });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: eventSpan as any,
      });

      const traceMap = (exporter as any).traceMap;
      const traceData = traceMap.get(eventSpan.traceId);

      // Event spans should not create trace data at all
      const hasSpan = traceData?.spans.has(eventSpan.id) ?? false;
      expect(hasSpan).toBe(false);
    });
  });

  describe('Message Formatting', () => {
    beforeEach(() => {
      exporter = new PosthogExporter(validConfig);
    });

    it('should format string input as message array', async () => {
      const generation = createSpan({
        type: SpanType.MODEL_GENERATION,
        input: 'Hello, world!',
      });

      await exportSpanLifecycle(exporter, generation);

      const capturedInput = mockCapture.mock.calls[0][0].properties.$ai_input;
      expect(capturedInput).toEqual([
        {
          role: 'user',
          content: [{ type: 'text', text: 'Hello, world!' }],
        },
      ]);
    });

    it('should normalize message array with string content', async () => {
      const generation = createSpan({
        type: SpanType.MODEL_GENERATION,
        input: [{ role: 'user', content: 'What is 2+2?' }],
      });

      await exportSpanLifecycle(exporter, generation);

      const capturedInput = mockCapture.mock.calls[0][0].properties.$ai_input;
      expect(capturedInput).toEqual([
        {
          role: 'user',
          content: [{ type: 'text', text: 'What is 2+2?' }],
        },
      ]);
    });
  });

  // --- Priority 4: Integration Scenarios ---
  describe('Out-of-Order Events', () => {
    beforeEach(() => {
      exporter = new PosthogExporter(validConfig);
    });

    it('should keep trace until last child ends when root ends first', async () => {
      const root = createSpan({
        id: 'root',
        traceId: 't1',
        type: SpanType.AGENT_RUN,
      });
      const child = createSpan({
        id: 'child',
        traceId: 't1',
        parentSpanId: 'root',
        type: SpanType.TOOL_CALL,
      });

      // Start both
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: root as any,
      });
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: child as any,
      });

      // End root BEFORE child
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: root as any,
      });

      const traceMap = (exporter as any).traceMap;
      expect(traceMap.has('t1')).toBe(true); // Still there

      // End child
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: child as any,
      });

      expect(traceMap.has('t1')).toBe(false); // Now cleaned up
    });
  });

  describe('Concurrent Traces', () => {
    beforeEach(() => {
      exporter = new PosthogExporter(validConfig);
    });

    it('should handle multiple traces concurrently without mixing data', async () => {
      const trace1 = createSpan({
        traceId: 't1',
        metadata: { userId: 'user-1' },
      });
      const trace2 = createSpan({
        traceId: 't2',
        metadata: { userId: 'user-2' },
      });

      await exportSpanLifecycle(exporter, trace1);
      await exportSpanLifecycle(exporter, trace2);

      expect(mockCapture).toHaveBeenNthCalledWith(1, expect.objectContaining({ distinctId: 'user-1' }));
      expect(mockCapture).toHaveBeenNthCalledWith(2, expect.objectContaining({ distinctId: 'user-2' }));

      const traceMap = (exporter as any).traceMap;
      expect(traceMap.size).toBe(0); // Both cleaned up
    });
  });
});

// --- Test Helper Functions ---

/**
 * Helper to create mock spans with defaults
 */
function createSpan(overrides: Partial<any> = {}): any {
  const now = Date.now();
  const id = overrides.id || `span-${Math.random()}`;
  const traceId = overrides.traceId || `trace-${Math.random()}`;

  return {
    id,
    traceId,
    type: SpanType.GENERIC,
    name: 'test-span',
    startTime: now,
    endTime: now + 100,
    isRootSpan: overrides.parentSpanId === undefined,
    isEvent: false,
    attributes: {},
    metadata: {},
    ...overrides,
  };
}

/**
 * Helper to export complete span lifecycle
 */
async function exportSpanLifecycle(exporter: PosthogExporter, span: any): Promise<void> {
  await exporter.exportTracingEvent({
    type: TracingEventType.SPAN_STARTED,
    exportedSpan: span,
  });
  await exporter.exportTracingEvent({
    type: TracingEventType.SPAN_ENDED,
    exportedSpan: span,
  });
}
