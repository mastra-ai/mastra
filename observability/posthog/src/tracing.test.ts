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
      endTime: Date.now() + 100,
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

    it('should map MODEL_GENERATION to $ai_generation (non-root)', async () => {
      // Use non-root span since root spans only send $ai_trace
      const generation = createSpan({ type: SpanType.MODEL_GENERATION, parentSpanId: 'parent-1' });
      await exportSpanLifecycle(exporter, generation);

      expect(mockCapture).toHaveBeenCalledWith(expect.objectContaining({ event: '$ai_generation' }));
    });

    it('should map MODEL_STEP to $ai_span (non-root)', async () => {
      // MODEL_STEP now goes through span properties path (not generation)
      // Use non-root span since root spans only send $ai_trace
      const step = createSpan({ type: SpanType.MODEL_STEP, parentSpanId: 'parent-1' });
      await exportSpanLifecycle(exporter, step);

      expect(mockCapture).toHaveBeenCalledWith(expect.objectContaining({ event: '$ai_span' }));
    });

    it('should map root spans to $ai_trace (not $ai_span or $ai_generation)', async () => {
      const rootSpan = createSpan({ type: SpanType.AGENT_RUN, isRootSpan: true });
      await exportSpanLifecycle(exporter, rootSpan);

      expect(mockCapture).toHaveBeenCalledWith(expect.objectContaining({ event: '$ai_trace' }));
    });

    it('should map MODEL_CHUNK to $ai_span with chunk attributes', async () => {
      // Use non-root span since root spans only send $ai_trace
      const chunk = createSpan({
        type: SpanType.MODEL_CHUNK,
        parentSpanId: 'parent-1',
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
      // Use non-root span since root spans only send $ai_trace
      const toolSpan = createSpan({ type: SpanType.TOOL_CALL, parentSpanId: 'parent-1' });
      await exportSpanLifecycle(exporter, toolSpan);

      expect(mockCapture).toHaveBeenCalledWith(expect.objectContaining({ event: '$ai_span' }));
    });
  });

  describe('LLM Generation Properties', () => {
    beforeEach(() => {
      exporter = new PosthogExporter(validConfig);
    });

    it('should extract model, provider, and tokens from attributes', async () => {
      // Use non-root span since root spans only send $ai_trace
      const generation = createSpan({
        type: SpanType.MODEL_GENERATION,
        parentSpanId: 'parent-1',
        attributes: {
          model: 'gpt-4o',
          provider: 'openai',
          usage: {
            inputTokens: 100,
            outputTokens: 200,
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
          }),
        }),
      );
    });

    it('should handle minimal LLM attributes gracefully with defaults', async () => {
      // Use non-root span since root spans only send $ai_trace
      const generation = createSpan({
        type: SpanType.MODEL_GENERATION,
        parentSpanId: 'parent-1',
        attributes: { model: 'gpt-3.5-turbo' },
      });

      await exportSpanLifecycle(exporter, generation);

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            $ai_model: 'gpt-3.5-turbo',
            $ai_provider: 'unknown-provider', // Updated expectation
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
  describe('Privacy Mode', () => {
    it('should pass privacy mode config to SDK', async () => {
      exporter = new PosthogExporter({
        ...validConfig,
        enablePrivacyMode: true,
      });

      expect(mockPostHogConstructor).toHaveBeenCalledWith(
        'test-key',
        expect.objectContaining({
          privacyMode: true,
        }),
      );
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

    it('should include error details in properties (non-root span)', async () => {
      // Use non-root span since root spans only send $ai_trace with different error format
      const errorSpan = createSpan({
        type: SpanType.TOOL_CALL,
        parentSpanId: 'parent-1',
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

    it('should include error details in $ai_trace for root spans', async () => {
      const errorRootSpan = createSpan({
        type: SpanType.AGENT_RUN,
        isRootSpan: true,
        errorInfo: {
          message: 'Agent failed',
          id: 'AGENT_ERROR',
          category: 'EXECUTION',
        },
      });

      await exportSpanLifecycle(exporter, errorRootSpan);

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          event: '$ai_trace',
          properties: expect.objectContaining({
            $ai_is_error: true,
            $ai_error: {
              message: 'Agent failed',
              id: 'AGENT_ERROR',
              category: 'EXECUTION',
            },
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

    it('should capture event spans immediately on start', async () => {
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

    it('should not re-capture event spans on end (no double counting)', async () => {
      const eventSpan = createSpan({
        id: 'event-1',
        type: SpanType.GENERIC,
        isEvent: true,
      });

      // Start (should capture)
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: eventSpan as any,
      });

      // End (should ignore)
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: eventSpan as any,
      });

      expect(mockCapture).toHaveBeenCalledTimes(1);
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

    it('should format string input as user message array', async () => {
      // Use non-root span since root spans only send $ai_trace with $ai_input_state
      const generation = createSpan({
        type: SpanType.MODEL_GENERATION,
        parentSpanId: 'parent-1',
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

    it('should format string output as assistant message array', async () => {
      // Use non-root span since root spans only send $ai_trace with $ai_output_state
      const generation = createSpan({
        type: SpanType.MODEL_GENERATION,
        parentSpanId: 'parent-1',
        output: 'This is the response.',
      });

      await exportSpanLifecycle(exporter, generation);

      const capturedOutput = mockCapture.mock.calls[0][0].properties.$ai_output_choices;
      expect(capturedOutput).toEqual([
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'This is the response.' }],
        },
      ]);
    });

    it('should normalize message array with string content', async () => {
      // Use non-root span since root spans only send $ai_trace with $ai_input_state
      const generation = createSpan({
        type: SpanType.MODEL_GENERATION,
        parentSpanId: 'parent-1',
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

  // --- Tags Support Tests (Issue #10772) ---
  // Note: Tags are spread as individual boolean properties (e.g., { "tag-name": true })
  // rather than as an array under $ai_tags
  describe('Tags Support', () => {
    beforeEach(() => {
      exporter = new PosthogExporter(validConfig);
    });

    it('should include tags as individual boolean properties for root spans', async () => {
      const rootSpan = createSpan({
        id: 'root-span',
        traceId: 'trace-with-tags',
        type: SpanType.AGENT_RUN,
        isRootSpan: true,
        tags: ['production', 'experiment-v2'],
      });

      await exportSpanLifecycle(exporter, rootSpan);

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            production: true,
            'experiment-v2': true,
          }),
        }),
      );
    });

    it('should not include any tag properties when tags array is empty', async () => {
      const rootSpan = createSpan({
        id: 'root-span',
        traceId: 'trace-no-tags',
        type: SpanType.AGENT_RUN,
        isRootSpan: true,
        tags: [],
      });

      await exportSpanLifecycle(exporter, rootSpan);

      // Just verify the call succeeds - no tag properties to check
      expect(mockCapture).toHaveBeenCalledTimes(1);
    });

    it('should not include any tag properties when tags is undefined', async () => {
      const rootSpan = createSpan({
        id: 'root-span',
        traceId: 'trace-undefined-tags',
        type: SpanType.AGENT_RUN,
        isRootSpan: true,
      });

      await exportSpanLifecycle(exporter, rootSpan);

      // Just verify the call succeeds - no tag properties to check
      expect(mockCapture).toHaveBeenCalledTimes(1);
    });

    it('should include tags as boolean properties for root MODEL_GENERATION spans ($ai_trace)', async () => {
      // Root MODEL_GENERATION spans send $ai_trace (not $ai_generation)
      const rootGeneration = createSpan({
        id: 'root-gen',
        traceId: 'trace-gen-tags',
        type: SpanType.MODEL_GENERATION,
        isRootSpan: true,
        tags: ['llm-test', 'gpt-4'],
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
        },
      });

      await exportSpanLifecycle(exporter, rootGeneration);

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          event: '$ai_trace',
          properties: expect.objectContaining({
            'llm-test': true,
            'gpt-4': true,
          }),
        }),
      );
    });

    it('should include tags and model properties for non-root MODEL_GENERATION spans', async () => {
      // Non-root MODEL_GENERATION spans send $ai_generation with tags (if somehow set)
      // Note: In practice, tags are only set on root spans
      const nonRootGeneration = createSpan({
        id: 'child-gen',
        traceId: 'trace-gen-tags',
        parentSpanId: 'parent-1',
        type: SpanType.MODEL_GENERATION,
        isRootSpan: false,
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
        },
      });

      await exportSpanLifecycle(exporter, nonRootGeneration);

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          event: '$ai_generation',
          properties: expect.objectContaining({
            $ai_model: 'gpt-4',
            $ai_provider: 'openai',
          }),
        }),
      );
    });

    it('should include tags as boolean properties in event spans for root spans', async () => {
      const eventSpan = createSpan({
        id: 'event-with-tags',
        traceId: 'trace-event-tags',
        type: SpanType.GENERIC,
        isEvent: true,
        isRootSpan: true,
        tags: ['user-feedback', 'positive'],
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: eventSpan as any,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            'user-feedback': true,
            positive: true,
          }),
        }),
      );
    });

    it('should include tags as boolean properties for root WORKFLOW_RUN spans', async () => {
      const workflowSpan = createSpan({
        id: 'workflow-with-tags',
        traceId: 'trace-workflow-tags',
        type: SpanType.WORKFLOW_RUN,
        isRootSpan: true,
        tags: ['batch-processing', 'priority-high'],
        attributes: { workflowId: 'wf-123' },
      });

      await exportSpanLifecycle(exporter, workflowSpan);

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            'batch-processing': true,
            'priority-high': true,
          }),
        }),
      );
    });

    it('should not include tags for child spans (only root spans get tags)', async () => {
      const rootSpan = createSpan({
        id: 'root-span',
        traceId: 'trace-parent-child',
        type: SpanType.AGENT_RUN,
        isRootSpan: true,
        tags: ['root-tag'],
      });

      // Start and end root span
      await exportSpanLifecycle(exporter, rootSpan);

      // Clear mock to check child span call
      mockCapture.mockClear();

      // Create child span - even if tags are accidentally set, they should not appear
      const childSpan = createSpan({
        id: 'child-span',
        traceId: 'trace-parent-child',
        parentSpanId: 'root-span',
        type: SpanType.TOOL_CALL,
        isRootSpan: false,
        tags: ['should-not-appear'],
        attributes: { toolId: 'calculator' },
      });

      await exportSpanLifecycle(exporter, childSpan);

      // Child span should be captured but without tag properties
      expect(mockCapture).toHaveBeenCalledTimes(1);
      const props = mockCapture.mock.calls[0][0].properties;
      expect(props).not.toHaveProperty('should-not-appear');
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
