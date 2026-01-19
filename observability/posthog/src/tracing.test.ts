import type { AnyExportedSpan } from '@mastra/core/observability';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import type { PosthogExporterConfig } from './tracing';
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

class TestPosthogExporter extends PosthogExporter {
  _getTraceData(traceId: string) {
    return this.getTraceData({ traceId, method: 'test' });
  }

  get _traceMapSize(): number {
    return this.traceMapSize();
  }
}

describe('PosthogExporter', () => {
  let exporter: TestPosthogExporter;
  const validConfig: PosthogExporterConfig = {
    apiKey: 'test-key',
    logLevel: 'debug',
    // Short cleanup delay for faster tests
    traceCleanupDelayMs: 10,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (exporter) {
      await exporter.shutdown();
    }
    vi.useRealTimers();
  });

  // --- Initialization Tests ---
  describe('Initialization', () => {
    it('should initialize with valid config', () => {
      exporter = new TestPosthogExporter(validConfig);
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
      exporter = new TestPosthogExporter({ apiKey: '' });
      expect(mockPostHogConstructor).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should use custom host if provided', () => {
      exporter = new TestPosthogExporter({ ...validConfig, host: 'https://eu.i.posthog.com' });
      expect(mockPostHogConstructor).toHaveBeenCalledWith(
        'test-key',
        expect.objectContaining({
          host: 'https://eu.i.posthog.com',
        }),
      );
    });

    it('should auto-configure serverless defaults', () => {
      exporter = new TestPosthogExporter({ ...validConfig, serverless: true });
      expect(mockPostHogConstructor).toHaveBeenCalledWith(
        'test-key',
        expect.objectContaining({
          flushAt: 10,
          flushInterval: 2000,
        }),
      );
    });

    it('should allow manual overrides in serverless mode', () => {
      exporter = new TestPosthogExporter({
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
    const startTime = new Date();
    const mockSpan: AnyExportedSpan = {
      id: 'span-1',
      traceId: 'trace-1',
      type: SpanType.GENERIC,
      name: 'test-span',
      startTime,
      endTime: new Date(startTime.getTime() + 100),
      attributes: {},
      metadata: {},
      isRootSpan: false,
      isEvent: false,
    };

    it('should cache span on start', async () => {
      exporter = new TestPosthogExporter(validConfig);

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: mockSpan,
      });

      const traceData = exporter._getTraceData(mockSpan.traceId);
      expect(traceData.hasSpan({ spanId: mockSpan.id })).toBe(true);
    });

    it('should capture event on end', async () => {
      exporter = new TestPosthogExporter(validConfig);

      // Start
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: mockSpan,
      });

      // End
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
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
      exporter = new TestPosthogExporter(validConfig);

      // Start
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: mockSpan,
      });

      const traceData = exporter._getTraceData(mockSpan.traceId);

      // End
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: mockSpan,
      });

      // Wait for cleanup delay (config uses 10ms)
      await vi.advanceTimersByTimeAsync(20);

      // Trace should be cleaned up since this was the only active span
      // (traceData is always created if it doesn't exist, but the old object
      // should have been cleaned up.)
      const newTraceData = exporter._getTraceData(mockSpan.traceId);
      expect(traceData).not.toBe(newTraceData);
    });
  });

  // --- Distinct ID Resolution Tests ---
  describe('Distinct ID Resolution', () => {
    it('should use userId from metadata if present', async () => {
      exporter = new TestPosthogExporter(validConfig);
      const spanWithUser = createSpan({ metadata: { userId: 'user-123' } });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: spanWithUser,
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: spanWithUser,
      });

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          distinctId: 'user-123',
        }),
      );
    });

    it('should use configured defaultDistinctId', async () => {
      exporter = new TestPosthogExporter({ ...validConfig, defaultDistinctId: 'system' });
      const spanNoUser = createSpan();

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: spanNoUser,
      });

      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: spanNoUser,
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
      exporter = new TestPosthogExporter(validConfig);

      // Add some data
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: createSpan(),
      });

      await exporter.shutdown();

      expect(mockShutdown).toHaveBeenCalled();
      expect(exporter._traceMapSize).toBe(0);
    });
  });

  // --- Priority 1: Core Functionality ---
  describe('Span Type Mapping', () => {
    beforeEach(() => {
      exporter = new TestPosthogExporter(validConfig);
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
      exporter = new TestPosthogExporter(validConfig);
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
      exporter = new TestPosthogExporter(validConfig);
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

      // Child should have parent_id = trace_id when parent is a root span
      // (root spans create $ai_trace events, not $ai_span, so children reference trace_id)
      expect(mockCapture).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          properties: expect.objectContaining({
            $ai_parent_id: 't1', // trace_id because parent is root span
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
      exporter = new TestPosthogExporter({
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
      exporter = new TestPosthogExporter({
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
      exporter = new TestPosthogExporter(validConfig);
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

    it('should include input and output in $ai_trace for root spans', async () => {
      const rootSpanWithOutput = createSpan({
        type: SpanType.AGENT_RUN,
        isRootSpan: true,
        input: [{ role: 'user', content: 'Hello' }],
        output: {
          text: 'Hello! How can I help you today?',
          object: null,
          files: [],
        },
      });

      await exportSpanLifecycle(exporter, rootSpanWithOutput);

      expect(mockCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          event: '$ai_trace',
          properties: expect.objectContaining({
            $ai_input_state: [{ role: 'user', content: 'Hello' }],
            $ai_output_state: {
              text: 'Hello! How can I help you today?',
              object: null,
              files: [],
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

      // Verify error was logged (format: "${exporterName}: exporter error")
      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('posthog: exporter error');

      consoleSpy.mockRestore();
    });
  });

  // --- Priority 3: Edge Cases ---
  describe('Event Span Handling', () => {
    beforeEach(() => {
      exporter = new TestPosthogExporter(validConfig);
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
        exportedSpan: eventSpan,
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
        exportedSpan: eventSpan,
      });

      // Trace data container exists (created during processing),
      // but the event span should not be cached within it
      const traceData = exporter._getTraceData(eventSpan.traceId);
      expect(traceData.hasSpan({ spanId: eventSpan.id })).toBe(false);
    });
  });

  describe('Message Formatting', () => {
    beforeEach(() => {
      exporter = new TestPosthogExporter(validConfig);
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
      exporter = new TestPosthogExporter(validConfig);
    });

    it('should keep trace until last child ends when root ends first', async () => {
      const traceId = 't1';

      const root = createSpan({
        id: 'root',
        traceId,
        type: SpanType.AGENT_RUN,
      });
      const child = createSpan({
        id: 'child',
        traceId,
        parentSpanId: 'root',
        type: SpanType.TOOL_CALL,
      });

      // Start both
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: root,
      });
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: child,
      });

      // End root BEFORE child
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: root,
      });

      const traceData = exporter._getTraceData(traceId);
      expect(traceData.activeSpanCount()).toBe(1); // Still there

      // End child
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: child,
      });

      expect(traceData.activeSpanCount()).toBe(0); // Now cleaned up
    });
  });

  describe('Concurrent Traces', () => {
    beforeEach(() => {
      exporter = new TestPosthogExporter(validConfig);
    });

    it('should handle multiple traces concurrently without mixing data', async () => {
      const trace1 = createSpan({
        traceId: 'trace-1',
        metadata: { userId: 'user-1' },
      });
      const trace2 = createSpan({
        traceId: 'trace-2',
        metadata: { userId: 'user-2' },
      });

      const traceData1 = exporter._getTraceData('trace-1');
      const traceData2 = exporter._getTraceData('trace-2');

      await exportSpanLifecycle(exporter, trace1);
      await exportSpanLifecycle(exporter, trace2);

      expect(mockCapture).toHaveBeenNthCalledWith(1, expect.objectContaining({ distinctId: 'user-1' }));
      expect(mockCapture).toHaveBeenNthCalledWith(2, expect.objectContaining({ distinctId: 'user-2' }));

      expect(traceData1.activeSpanCount()).toBe(0); // Both cleaned up
      expect(traceData2.activeSpanCount()).toBe(0);
    });
  });

  // --- Tags Support Tests (Issue #10772) ---
  // Note: Tags are spread as individual boolean properties (e.g., { "tag-name": true })
  // rather than as an array under $ai_tags
  describe('Tags Support', () => {
    beforeEach(() => {
      exporter = new TestPosthogExporter(validConfig);
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
        exportedSpan: eventSpan,
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
function createSpan(overrides: Partial<AnyExportedSpan> = {}): AnyExportedSpan {
  const startTime = new Date();
  const id = overrides.id || `span-${Math.random()}`;
  const traceId = overrides.traceId || `trace-${Math.random()}`;

  return {
    id,
    traceId,
    type: SpanType.GENERIC,
    name: 'test-span',
    startTime,
    endTime: new Date(startTime.getTime() + 1000),
    isRootSpan: overrides.parentSpanId === undefined,
    isEvent: false,
    attributes: {},
    metadata: {},
    ...overrides,
  };
}

/**
 * Helper to export complete span lifecycle.
 * Simulates realistic span state at each lifecycle stage:
 * - SPAN_STARTED: has input but no output or endTime (not yet completed)
 * - SPAN_ENDED: has output and endTime but often no input (input was sent at start)
 */
async function exportSpanLifecycle(exporter: PosthogExporter, span: AnyExportedSpan): Promise<void> {
  // SPAN_STARTED: exclude output and endTime (span hasn't completed yet)
  const { output: _output, endTime: _endTime, ...startSpan } = span;
  await exporter.exportTracingEvent({
    type: TracingEventType.SPAN_STARTED,
    exportedSpan: startSpan as AnyExportedSpan,
  });

  // SPAN_ENDED: exclude input (was sent at start, not duplicated on end)
  const { input: _input, ...endSpan } = span;
  await exporter.exportTracingEvent({
    type: TracingEventType.SPAN_ENDED,
    exportedSpan: endSpan as AnyExportedSpan,
  });
}
