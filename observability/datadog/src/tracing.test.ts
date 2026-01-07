/**
 * Tests for Datadog LLM Observability Exporter
 *
 * Uses mock dd-trace to test the exporter without connecting to Datadog.
 */

/// <reference types="node" />

import type { TracingEvent, AnyExportedSpan } from '@mastra/core/observability';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to define mocks before they're used in vi.mock
const {
  mockAnnotate,
  mockTrace,
  mockFlush,
  mockDisable,
  mockEnable,
  mockInit,
  mockSubmitEvaluation,
  mockScopeActivate,
  mockScopeActive,
  traceParents,
  capturedSpans,
} = vi.hoisted(() => {
  let currentScopeSpan: any = undefined;
  const parents: any[] = [];
  const spans: any[] = [];

  const activate = vi.fn((span: any, fn: () => void) => {
    const previous = currentScopeSpan;
    currentScopeSpan = span;
    try {
      return fn();
    } finally {
      currentScopeSpan = previous;
    }
  });

  const active = vi.fn(() => currentScopeSpan);

  return {
    traceParents: parents,
    capturedSpans: spans,
    mockAnnotate: vi.fn(),
    // Simulate dd-trace behavior: llmobs.trace() activates the span in scope for the callback duration
    mockTrace: vi.fn((options: any, fn: (span: any) => void) => {
      parents.push(currentScopeSpan);
      const ddSpan = {
        id: `mock-dd-span-${parents.length}`,
        options,
        setTag: vi.fn(),
      };
      spans.push(ddSpan);
      // Activate this span in scope for the duration of the callback
      // This simulates how dd-trace automatically activates spans during trace()
      const previous = currentScopeSpan;
      currentScopeSpan = ddSpan;
      try {
        return fn(ddSpan);
      } finally {
        currentScopeSpan = previous;
      }
    }),
    mockFlush: vi.fn().mockResolvedValue(undefined),
    mockDisable: vi.fn(),
    mockEnable: vi.fn(),
    mockInit: vi.fn(),
    mockSubmitEvaluation: vi.fn(),
    mockScopeActivate: activate,
    mockScopeActive: active,
  };
});

// Mock dd-trace before importing the exporter
vi.mock('dd-trace', () => {
  return {
    default: {
      init: mockInit,
      llmobs: {
        enable: mockEnable,
        disable: mockDisable,
        trace: mockTrace,
        annotate: mockAnnotate,
        flush: mockFlush,
        submitEvaluation: mockSubmitEvaluation,
        exportSpan: (span: any) => ({ traceId: 'dd-trace-id', spanId: span?.id || 'dd-span-id' }),
      },
      _tracer: { started: false },
      scope: () => ({
        activate: mockScopeActivate,
        active: mockScopeActive,
      }),
    },
  };
});

import { DatadogExporter } from './tracing';

/**
 * Creates a mock span with default values
 * Note: isRootSpan defaults to true so spans emit immediately in tests.
 * For parent-child hierarchy tests, set isRootSpan: false explicitly.
 */
function createMockSpan(overrides: Partial<AnyExportedSpan> = {}): AnyExportedSpan {
  return {
    id: 'span-1',
    traceId: 'trace-1',
    name: 'test-span',
    type: SpanType.GENERIC,
    startTime: new Date('2024-01-01T00:00:00Z'),
    endTime: new Date('2024-01-01T00:00:01Z'),
    isEvent: false,
    isRootSpan: true,
    ...overrides,
  } as AnyExportedSpan;
}

/**
 * Creates a tracing event
 */
function createTracingEvent(type: TracingEventType, span: AnyExportedSpan): TracingEvent {
  return { type, exportedSpan: span } as TracingEvent;
}

describe('DatadogExporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    traceParents.length = 0;
    capturedSpans.length = 0;
    // Reset environment variables
    delete process.env.DD_API_KEY;
    delete process.env.DD_LLMOBS_ML_APP;
    delete process.env.DD_SITE;
    delete process.env.DD_LLMOBS_AGENTLESS_ENABLED;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('configuration', () => {
    it('initializes with valid config', () => {
      const exporter = new DatadogExporter({
        mlApp: 'test-app',
        apiKey: 'test-key',
        agentless: true,
      });

      expect(mockEnable).toHaveBeenCalledWith(
        expect.objectContaining({
          mlApp: 'test-app',
          agentlessEnabled: true,
        }),
      );
      expect(exporter.name).toBe('datadog');
    });

    it('disables exporter when mlApp is missing', () => {
      new DatadogExporter({});
      // Exporter should be disabled - verify by checking that trace is not called on export
      expect(mockEnable).not.toHaveBeenCalled();
    });

    it('disables exporter when agentless mode lacks apiKey', () => {
      new DatadogExporter({
        mlApp: 'test-app',
        agentless: true,
        // apiKey not provided
      });
      // Exporter should be disabled
      expect(mockEnable).not.toHaveBeenCalled();
    });

    it('allows non-agentless mode without apiKey', () => {
      const exporter = new DatadogExporter({
        mlApp: 'test-app',
        agentless: false,
      });

      // Exporter should not be disabled
      expect(exporter['isDisabled']).toBe(false);
      expect(exporter.name).toBe('datadog');
    });

    it('reads configuration from environment variables', () => {
      process.env.DD_LLMOBS_ML_APP = 'env-app';
      process.env.DD_API_KEY = 'env-key';
      process.env.DD_LLMOBS_AGENTLESS_ENABLED = 'true';

      const exporter = new DatadogExporter({});

      // Exporter should not be disabled when env vars are set
      expect(exporter['isDisabled']).toBe(false);
    });

    it('prefers config values over environment variables', () => {
      process.env.DD_LLMOBS_ML_APP = 'env-app';

      const exporter = new DatadogExporter({
        mlApp: 'config-app',
        agentless: false,
      });

      // Exporter should not be disabled
      expect(exporter['isDisabled']).toBe(false);
      // Config value is stored in exporter.config
      expect(exporter['config'].mlApp).toBe('config-app');
    });
  });

  describe('span type mapping', () => {
    it.each([
      [SpanType.AGENT_RUN, 'agent'],
      [SpanType.MODEL_GENERATION, 'workflow'],
      [SpanType.MODEL_STEP, 'llm'],
      [SpanType.MODEL_CHUNK, 'task'],
      [SpanType.TOOL_CALL, 'tool'],
      [SpanType.MCP_TOOL_CALL, 'tool'],
      [SpanType.WORKFLOW_RUN, 'workflow'],
      [SpanType.WORKFLOW_STEP, 'task'],
      [SpanType.WORKFLOW_CONDITIONAL, 'task'],
      [SpanType.WORKFLOW_CONDITIONAL_EVAL, 'task'],
      [SpanType.WORKFLOW_PARALLEL, 'task'],
      [SpanType.WORKFLOW_LOOP, 'task'],
      [SpanType.WORKFLOW_SLEEP, 'task'],
      [SpanType.WORKFLOW_WAIT_EVENT, 'task'],
      [SpanType.PROCESSOR_RUN, 'task'],
      [SpanType.GENERIC, 'task'],
    ])('maps %s to %s kind', async (spanType, expectedKind) => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({ type: spanType });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      expect(mockTrace).toHaveBeenCalledWith(expect.objectContaining({ kind: expectedKind }), expect.any(Function));
    });
  });

  describe('error handling', () => {
    it('includes error tags for error spans', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({
        errorInfo: {
          message: 'Something went wrong',
          id: 'err-123',
          category: 'validation',
        },
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      expect(mockAnnotate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          tags: expect.objectContaining({
            error: true,
            errorInfo: {
              message: 'Something went wrong',
              id: 'err-123',
              category: 'validation',
            },
          }),
        }),
      );
    });

    it('handles spans without errors', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({ metadata: { key: 'value' } });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      expect(mockAnnotate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          metadata: { key: 'value' },
        }),
      );
    });

    it('sets native Datadog error status on ddSpan for error spans', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({
        errorInfo: {
          message: 'Something went wrong',
        },
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      // Verify setTag was called with error: true
      expect(capturedSpans[0].setTag).toHaveBeenCalledWith('error', true);
    });

    it('does not set native error status for non-error spans', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan();

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      // Verify setTag was NOT called
      expect(capturedSpans[0].setTag).not.toHaveBeenCalled();
    });
  });

  describe('span tags', () => {
    it('converts span.tags string array to object format', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({
        tags: ['production', 'experiment-v2', 'user-request'],
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      expect(mockAnnotate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          tags: {
            production: true,
            'experiment-v2': true,
            'user-request': true,
          },
        }),
      );
    });

    it('merges span.tags with error tags when both present', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({
        tags: ['production', 'critical'],
        errorInfo: {
          message: 'Something failed',
          category: 'runtime',
        },
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      expect(mockAnnotate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          tags: {
            production: true,
            critical: true,
            error: true,
            errorInfo: {
              message: 'Something failed',
              category: 'runtime',
            },
          },
        }),
      );
    });

    it('does not include tags in annotations when span.tags is empty', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({
        tags: [],
        input: 'test input', // Include input so annotations are not empty
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      // mockAnnotate should be called, but without tags
      expect(mockAnnotate).toHaveBeenCalled();
      const annotateCall = mockAnnotate.mock.calls[0][1];
      expect(annotateCall).not.toHaveProperty('tags');
    });

    it('does not include tags in annotations when span.tags is undefined', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({
        // tags not specified
        input: 'test input', // Include input so annotations are not empty
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      // mockAnnotate should be called, but without tags
      expect(mockAnnotate).toHaveBeenCalled();
      const annotateCall = mockAnnotate.mock.calls[0][1];
      expect(annotateCall).not.toHaveProperty('tags');
    });
  });

  describe('event lifecycle', () => {
    it('captures trace context on span_started for root spans', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({
        isRootSpan: true,
        metadata: { userId: 'user-1', sessionId: 'session-1' },
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, span));

      // No trace call on span_started
      expect(mockTrace).not.toHaveBeenCalled();
    });

    it('ignores span_updated events (completion-only pattern)', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan();

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_UPDATED, span));

      expect(mockTrace).not.toHaveBeenCalled();
    });

    it('emits complete span on span_ended', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({ name: 'test-operation' });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      expect(mockTrace).toHaveBeenCalledWith(expect.objectContaining({ name: 'test-operation' }), expect.any(Function));
    });

    it('uses trace context for user/session on span_ended', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const rootSpan = createMockSpan({
        id: 'root',
        isRootSpan: true,
        traceId: 'trace-123',
        metadata: { userId: 'user-1', sessionId: 'session-1' },
      });
      const childSpan = createMockSpan({
        id: 'child',
        traceId: 'trace-123',
        isRootSpan: false,
        parentSpanId: 'root',
      });

      // First capture context from root
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, rootSpan));
      // Buffer child span (waiting for tree emission)
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, childSpan));
      // End root to trigger tree emission
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, rootSpan));

      // Both spans should be emitted with inherited user/session context
      expect(mockTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          sessionId: 'session-1',
        }),
        expect.any(Function),
      );
    });
  });

  describe('event spans', () => {
    it('buffers event spans on span_started like regular spans', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      // Event span without parent should emit immediately (like root span)
      const eventSpan = createMockSpan({ isEvent: true, isRootSpan: true });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, eventSpan));

      expect(mockTrace).toHaveBeenCalledTimes(1);
    });

    it('ignores event spans on span_updated', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const eventSpan = createMockSpan({ isEvent: true });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_UPDATED, eventSpan));

      expect(mockTrace).not.toHaveBeenCalled();
    });

    it('ignores event spans on span_ended', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const eventSpan = createMockSpan({ isEvent: true });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, eventSpan));

      expect(mockTrace).not.toHaveBeenCalled();
    });

    it('emits event spans with zero duration when endTime not set', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const startTime = new Date('2024-01-01T00:00:00Z');
      const eventSpan = createMockSpan({
        isEvent: true,
        isRootSpan: true, // Root event spans emit immediately
        startTime,
        endTime: undefined,
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, eventSpan));

      expect(mockTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime,
          endTime: startTime,
        }),
        expect.any(Function),
      );
    });

    it('buffers event spans until parent exists and emits with parent context', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const parentSpan = createMockSpan({
        id: 'parent',
        traceId: 'trace-event-parent',
        isRootSpan: true,
        type: SpanType.MODEL_STEP,
      });
      const eventSpan = createMockSpan({
        id: 'chunk-event',
        traceId: 'trace-event-parent',
        isEvent: true,
        isRootSpan: false,
        parentSpanId: 'parent',
        type: SpanType.MODEL_CHUNK,
      });

      // Event span arrives before parent ends - should be buffered
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, eventSpan));
      expect(mockTrace).toHaveBeenCalledTimes(0);

      // Parent ends - both should emit with correct hierarchy
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, parentSpan));
      expect(mockTrace).toHaveBeenCalledTimes(2);

      // First trace call is parent (no parent context)
      expect(traceParents[0]).toBeUndefined();
      // Second trace call is event (with parent context)
      expect(traceParents[1]).toEqual(expect.objectContaining({ id: 'mock-dd-span-1' }));
    });
  });

  describe('parent-child hierarchy', () => {
    it('emits child spans under the parent scope when parent ends first', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const rootSpan = createMockSpan({ id: 'root', traceId: 'trace-parent', isRootSpan: true });
      const childSpan = createMockSpan({
        id: 'child',
        traceId: 'trace-parent',
        isRootSpan: false,
        parentSpanId: 'root',
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, rootSpan));
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, childSpan));

      expect(mockTrace).toHaveBeenCalledTimes(2);
      expect(traceParents[0]).toBeUndefined();
      expect(traceParents[1]).toEqual(expect.objectContaining({ id: 'mock-dd-span-1' }));
    });

    it('buffers child spans until the parent context exists', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const rootSpan = createMockSpan({ id: 'root', traceId: 'trace-buffer', isRootSpan: true });
      const childSpan = createMockSpan({
        id: 'child',
        traceId: 'trace-buffer',
        isRootSpan: false,
        parentSpanId: 'root',
      });

      // Child ends before parent
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, childSpan));
      expect(mockTrace).toHaveBeenCalledTimes(0);

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, rootSpan));

      expect(mockTrace).toHaveBeenCalledTimes(2);
      expect(traceParents[0]).toBeUndefined();
      expect(traceParents[1]).toEqual(expect.objectContaining({ id: 'mock-dd-span-1' }));
    });
  });

  describe('out-of-order events', () => {
    it('keeps trace context until last child ends when root ends first', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const rootSpan = createMockSpan({
        id: 'root',
        traceId: 'trace-ooo',
        isRootSpan: true,
        metadata: { userId: 'user-ooo', sessionId: 'session-ooo' },
      });
      const childSpan = createMockSpan({
        id: 'child',
        traceId: 'trace-ooo',
        isRootSpan: false,
        parentSpanId: 'root',
      });

      // Start both spans to capture trace context
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, rootSpan));
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, childSpan));

      // End root BEFORE child (out-of-order)
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, rootSpan));
      expect(mockTrace).toHaveBeenCalledTimes(1); // Root emitted

      // End child - should still have access to trace context
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, childSpan));
      expect(mockTrace).toHaveBeenCalledTimes(2); // Both emitted

      // Verify child inherited user/session from trace context
      expect(mockTrace).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          userId: 'user-ooo',
          sessionId: 'session-ooo',
        }),
        expect.any(Function),
      );
    });

    it('handles span updates after parent has ended', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const rootSpan = createMockSpan({
        id: 'root',
        traceId: 'trace-update',
        isRootSpan: true,
      });
      const childSpan = createMockSpan({
        id: 'child',
        traceId: 'trace-update',
        isRootSpan: false,
        parentSpanId: 'root',
      });

      // Start both, end root
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, rootSpan));
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, childSpan));
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, rootSpan));

      // Update child after root ended (should be ignored per completion-only pattern)
      const updatedChild = { ...childSpan, output: 'updated output' };
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_UPDATED, updatedChild));

      // Should not throw, update is silently ignored
      expect(mockTrace).toHaveBeenCalledTimes(1); // Only root emitted so far

      // End child normally
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, childSpan));
      expect(mockTrace).toHaveBeenCalledTimes(2);
    });
  });

  describe('concurrent traces', () => {
    it('handles multiple traces concurrently without mixing data', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });

      const trace1Span = createMockSpan({
        id: 'span-t1',
        traceId: 'trace-1',
        isRootSpan: true,
        metadata: { userId: 'user-1', sessionId: 'session-1' },
      });
      const trace2Span = createMockSpan({
        id: 'span-t2',
        traceId: 'trace-2',
        isRootSpan: true,
        metadata: { userId: 'user-2', sessionId: 'session-2' },
      });

      // Start both traces
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, trace1Span));
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, trace2Span));

      // End in reverse order
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, trace2Span));
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, trace1Span));

      expect(mockTrace).toHaveBeenCalledTimes(2);

      // Verify trace 2 was emitted first with correct user/session
      expect(mockTrace).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          userId: 'user-2',
          sessionId: 'session-2',
        }),
        expect.any(Function),
      );

      // Verify trace 1 was emitted second with correct user/session
      expect(mockTrace).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          userId: 'user-1',
          sessionId: 'session-1',
        }),
        expect.any(Function),
      );
    });

    it('maintains separate buffers for concurrent traces with child spans', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });

      // Two concurrent traces, each with parent and child
      const trace1Root = createMockSpan({
        id: 'root-1',
        traceId: 'trace-1',
        isRootSpan: true,
        metadata: { userId: 'user-1' },
      });
      const trace1Child = createMockSpan({
        id: 'child-1',
        traceId: 'trace-1',
        isRootSpan: false,
        parentSpanId: 'root-1',
      });
      const trace2Root = createMockSpan({
        id: 'root-2',
        traceId: 'trace-2',
        isRootSpan: true,
        metadata: { userId: 'user-2' },
      });
      const trace2Child = createMockSpan({
        id: 'child-2',
        traceId: 'trace-2',
        isRootSpan: false,
        parentSpanId: 'root-2',
      });

      // Start all spans
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, trace1Root));
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, trace2Root));

      // End children before parents (buffered)
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, trace1Child));
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, trace2Child));
      expect(mockTrace).toHaveBeenCalledTimes(0); // Both buffered

      // End trace 2 root - should emit trace 2 spans only
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, trace2Root));
      expect(mockTrace).toHaveBeenCalledTimes(2); // trace2 root + child

      // Verify trace 2 spans have correct user
      expect(mockTrace).toHaveBeenNthCalledWith(1, expect.objectContaining({ userId: 'user-2' }), expect.any(Function));
      expect(mockTrace).toHaveBeenNthCalledWith(2, expect.objectContaining({ userId: 'user-2' }), expect.any(Function));

      // End trace 1 root - should emit trace 1 spans only
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, trace1Root));
      expect(mockTrace).toHaveBeenCalledTimes(4); // All 4 spans emitted

      // Verify trace 1 spans have correct user (calls 3 and 4)
      expect(mockTrace).toHaveBeenNthCalledWith(3, expect.objectContaining({ userId: 'user-1' }), expect.any(Function));
      expect(mockTrace).toHaveBeenNthCalledWith(4, expect.objectContaining({ userId: 'user-1' }), expect.any(Function));
    });

    it('isolates parent-child relationships across concurrent traces', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });

      // Two traces with same span structure but different IDs
      const trace1Root = createMockSpan({
        id: 'root',
        traceId: 'trace-1',
        isRootSpan: true,
        name: 'trace1-root',
      });
      const trace1Child = createMockSpan({
        id: 'child',
        traceId: 'trace-1',
        isRootSpan: false,
        parentSpanId: 'root',
        name: 'trace1-child',
      });
      const trace2Root = createMockSpan({
        id: 'root', // Same ID as trace1, different trace
        traceId: 'trace-2',
        isRootSpan: true,
        name: 'trace2-root',
      });
      const trace2Child = createMockSpan({
        id: 'child', // Same ID as trace1, different trace
        traceId: 'trace-2',
        isRootSpan: false,
        parentSpanId: 'root',
        name: 'trace2-child',
      });

      // Interleaved execution
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, trace1Root));
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, trace2Root));
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, trace1Child));
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, trace2Child));

      expect(mockTrace).toHaveBeenCalledTimes(4);

      // Verify spans are emitted with correct names (proving isolation)
      const emittedNames = mockTrace.mock.calls.map((call: any) => call[0].name);
      expect(emittedNames).toContain('trace1-root');
      expect(emittedNames).toContain('trace1-child');
      expect(emittedNames).toContain('trace2-root');
      expect(emittedNames).toContain('trace2-child');

      // Verify parent-child relationships are correct per trace
      // trace1-child should have trace1-root as parent (traceParents[2] should be mock-dd-span-1)
      // trace2-child should have trace2-root as parent (traceParents[3] should be mock-dd-span-2)
      expect(traceParents[0]).toBeUndefined(); // trace1-root has no parent
      expect(traceParents[1]).toBeUndefined(); // trace2-root has no parent
      expect(traceParents[2]).toEqual(expect.objectContaining({ id: 'mock-dd-span-1' })); // trace1-child under trace1-root
      expect(traceParents[3]).toEqual(expect.objectContaining({ id: 'mock-dd-span-2' })); // trace2-child under trace2-root
    });
  });

  describe('trace state cleanup', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('schedules cleanup timer after root ends and buffer empties', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const rootSpan = createMockSpan({
        id: 'root',
        traceId: 'trace-cleanup',
        isRootSpan: true,
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, rootSpan));
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, rootSpan));

      // Verify traceState exists before cleanup
      expect((exporter as any).traceState.has('trace-cleanup')).toBe(true);

      // Advance timer by 60 seconds (cleanup delay)
      await vi.advanceTimersByTimeAsync(60_000);

      // Verify traceState is cleaned up
      expect((exporter as any).traceState.has('trace-cleanup')).toBe(false);
      expect((exporter as any).traceContext.has('trace-cleanup')).toBe(false);
    });

    it('clears traceContext on cleanup', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const rootSpan = createMockSpan({
        id: 'root',
        traceId: 'trace-ctx-cleanup',
        isRootSpan: true,
        metadata: { userId: 'test-user' },
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, rootSpan));

      // Verify context was captured
      expect((exporter as any).traceContext.has('trace-ctx-cleanup')).toBe(true);
      expect((exporter as any).traceContext.get('trace-ctx-cleanup').userId).toBe('test-user');

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, rootSpan));

      // Advance timer
      await vi.advanceTimersByTimeAsync(60_000);

      // Both traceState and traceContext should be cleaned
      expect((exporter as any).traceContext.has('trace-ctx-cleanup')).toBe(false);
    });

    it('does not leak state between traces after cleanup', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });

      // First trace
      const trace1 = createMockSpan({
        id: 'root-1',
        traceId: 'trace-leak-1',
        isRootSpan: true,
        metadata: { userId: 'user-1' },
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, trace1));
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, trace1));

      // Cleanup first trace
      await vi.advanceTimersByTimeAsync(60_000);

      // Second trace with same traceId (simulating trace ID reuse)
      const trace2 = createMockSpan({
        id: 'root-2',
        traceId: 'trace-leak-1', // Same traceId!
        isRootSpan: true,
        metadata: { userId: 'user-2' }, // Different user
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, trace2));
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, trace2));

      // Verify second trace uses its own context, not leaked from first
      expect(mockTrace).toHaveBeenLastCalledWith(
        expect.objectContaining({ userId: 'user-2' }), // Should be user-2, not user-1
        expect.any(Function),
      );
    });

    it('cleans up traces without root span after max lifetime (30 minutes)', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const loggerSpy = vi.spyOn((exporter as any).logger, 'warn');

      // Create a non-root span (simulating a trace where root span never arrives)
      const orphanedSpan = createMockSpan({
        id: 'orphaned',
        traceId: 'trace-no-root',
        isRootSpan: false, // Not a root span
        parentSpanId: 'missing-parent', // Parent never arrives
      });

      // End the span - it will be buffered waiting for parent
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, orphanedSpan));

      // Verify state exists and span is buffered
      expect((exporter as any).traceState.has('trace-no-root')).toBe(true);
      expect((exporter as any).traceState.get('trace-no-root').buffer.size).toBe(1);

      // Advance time by 30 minutes (max lifetime)
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);

      // Verify state was cleaned up
      expect((exporter as any).traceState.has('trace-no-root')).toBe(false);

      // Verify warning was logged
      expect(loggerSpy).toHaveBeenCalledWith(
        'Discarding trace due to max lifetime exceeded',
        expect.objectContaining({
          traceId: 'trace-no-root',
          bufferedSpans: 1,
        }),
      );
    });

    it('cancels max lifetime timer when normal cleanup runs', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });

      const rootSpan = createMockSpan({
        id: 'root',
        traceId: 'trace-normal-cleanup',
        isRootSpan: true,
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, rootSpan));
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, rootSpan));

      // Verify state exists with max lifetime timer
      const state = (exporter as any).traceState.get('trace-normal-cleanup');
      expect(state?.maxLifetimeTimer).toBeDefined();

      // Advance to normal cleanup (60 seconds)
      await vi.advanceTimersByTimeAsync(60_000);

      // State should be cleaned up by normal cleanup
      expect((exporter as any).traceState.has('trace-normal-cleanup')).toBe(false);

      // Advance to max lifetime - should not cause any issues since state is already gone
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);

      // No errors should occur
      expect((exporter as any).traceState.has('trace-normal-cleanup')).toBe(false);
    });
  });

  describe('shutdown', () => {
    it('flushes and disables llmobs on shutdown', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });

      await exporter.shutdown();

      expect(mockFlush).toHaveBeenCalled();
      expect(mockDisable).toHaveBeenCalled();
    });

    it('clears traceState on shutdown', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({ traceId: 'trace-shutdown', isRootSpan: true });

      // Create some trace state
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, span));
      expect((exporter as any).traceContext.has('trace-shutdown')).toBe(true);

      await exporter.shutdown();

      // Both traceState and traceContext should be cleared
      expect((exporter as any).traceState.size).toBe(0);
      expect((exporter as any).traceContext.size).toBe(0);
    });

    it('cancels pending cleanup timers on shutdown', async () => {
      vi.useFakeTimers();
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({ traceId: 'trace-timer', isRootSpan: true });

      // Start and end span to trigger cleanup timer scheduling
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, span));
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      // Verify cleanup timer was scheduled
      const state = (exporter as any).traceState.get('trace-timer');
      expect(state?.cleanupTimer).toBeDefined();

      // Shutdown should cancel the timer
      await exporter.shutdown();

      // traceState should be cleared immediately, not waiting for timer
      expect((exporter as any).traceState.size).toBe(0);

      vi.useRealTimers();
    });

    it('logs warning when shutdown has pending buffered spans', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const loggerSpy = vi.spyOn((exporter as any).logger, 'warn');

      const parentSpan = createMockSpan({
        id: 'parent',
        traceId: 'trace-pending',
        isRootSpan: true,
      });
      const childSpan = createMockSpan({
        id: 'child',
        traceId: 'trace-pending',
        isRootSpan: false,
        parentSpanId: 'parent',
      });

      // Start parent, end child (child is buffered waiting for parent)
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, parentSpan));
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, childSpan));

      // Child should be buffered
      expect(mockTrace).toHaveBeenCalledTimes(0);

      // Shutdown with pending spans
      await exporter.shutdown();

      // Should warn about pending spans
      expect(loggerSpy).toHaveBeenCalledWith(
        'Shutdown with pending spans',
        expect.objectContaining({
          traceId: 'trace-pending',
          pendingCount: 1,
        }),
      );
    });
  });

  describe('model info for LLM spans', () => {
    it('includes modelName and modelProvider for llm spans', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({
        type: SpanType.MODEL_STEP,
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
        },
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      expect(mockTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'llm',
          modelName: 'gpt-4',
          modelProvider: 'openai',
        }),
        expect.any(Function),
      );
    });

    it('does not include model info for non-llm spans', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({
        type: SpanType.TOOL_CALL,
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
        },
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      const traceCall = mockTrace.mock.calls[0][0];
      expect(traceCall.modelName).toBeUndefined();
      expect(traceCall.modelProvider).toBeUndefined();
    });
  });

  describe('error handling in export', () => {
    it('catches and logs errors from dd-trace during export', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const loggerSpy = vi.spyOn((exporter as any).logger, 'error');

      // Make mockTrace throw an error
      mockTrace.mockImplementationOnce(() => {
        throw new Error('dd-trace internal error');
      });

      const span = createMockSpan({ id: 'error-span', name: 'error-test' });

      // Should not throw
      await expect(
        exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span)),
      ).resolves.not.toThrow();

      // Should log the error
      expect(loggerSpy).toHaveBeenCalledWith(
        'Datadog exporter error',
        expect.objectContaining({
          error: expect.any(Error),
          eventType: 'span_ended',
          spanId: 'error-span',
          spanName: 'error-test',
        }),
      );
    });

    it('continues processing after errors in export', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });

      // First call throws, second succeeds
      mockTrace
        .mockImplementationOnce(() => {
          throw new Error('temporary error');
        })
        .mockImplementation((_options: any, fn: (span: any) => void) => {
          const ddSpan = { id: 'recovered', setTag: vi.fn() };
          capturedSpans.push(ddSpan);
          return fn(ddSpan);
        });

      const span1 = createMockSpan({ id: 'span-1', traceId: 'trace-1', isRootSpan: true });
      const span2 = createMockSpan({ id: 'span-2', traceId: 'trace-2', isRootSpan: true });

      // First span fails
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span1));
      // Second span should still work
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span2));

      // Second call should have succeeded
      expect(mockTrace).toHaveBeenCalledTimes(2);
      expect(capturedSpans).toHaveLength(1); // Only second span captured
    });
  });

  describe('attribute forwarding', () => {
    it('forwards custom tool attributes to metadata', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({
        type: SpanType.TOOL_CALL,
        attributes: {
          toolId: 'search-tool',
          toolName: 'web_search',
          customAttr: 'custom-value',
        },
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      expect(mockAnnotate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          metadata: expect.objectContaining({
            toolId: 'search-tool',
            toolName: 'web_search',
            customAttr: 'custom-value',
          }),
        }),
      );
    });

    it('forwards workflow step attributes to metadata', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({
        type: SpanType.WORKFLOW_STEP,
        attributes: {
          stepId: 'step-1',
          stepName: 'validate-input',
          retryCount: 2,
        },
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      expect(mockAnnotate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          metadata: expect.objectContaining({
            stepId: 'step-1',
            stepName: 'validate-input',
            retryCount: 2,
          }),
        }),
      );
    });

    it('merges span.metadata with span.attributes in metadata', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({
        type: SpanType.TOOL_CALL,
        metadata: { userTag: 'important', priority: 'high' },
        attributes: {
          toolId: 'calc-tool',
          duration: 150,
        },
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      expect(mockAnnotate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          metadata: expect.objectContaining({
            userTag: 'important',
            priority: 'high',
            toolId: 'calc-tool',
            duration: 150,
          }),
        }),
      );
    });

    it('excludes known LLM fields from attribute forwarding', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({
        type: SpanType.MODEL_STEP,
        metadata: { userKey: 'userValue' },
        attributes: {
          model: 'gpt-4', // Should be excluded (used for modelName)
          provider: 'openai', // Should be excluded (used for modelProvider)
          usage: { inputTokens: 100, outputTokens: 50 }, // Should be excluded (used for metrics)
          parameters: { temperature: 0.7 }, // Should be excluded
          customLlmAttr: 'preserved', // Should be included
        },
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      // Verify model/provider are used for trace options
      expect(mockTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: 'gpt-4',
          modelProvider: 'openai',
        }),
        expect.any(Function),
      );

      // Verify usage is in metrics
      expect(mockAnnotate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          metrics: expect.objectContaining({
            inputTokens: 100,
            outputTokens: 50,
          }),
        }),
      );

      // Verify excluded fields are NOT in metadata, but custom attrs are
      expect(mockAnnotate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          metadata: expect.objectContaining({
            userKey: 'userValue',
            customLlmAttr: 'preserved',
          }),
        }),
      );

      // Get the actual metadata passed to annotate
      const annotateCall = mockAnnotate.mock.calls[0][1];
      expect(annotateCall.metadata).not.toHaveProperty('model');
      expect(annotateCall.metadata).not.toHaveProperty('provider');
      expect(annotateCall.metadata).not.toHaveProperty('usage');
      expect(annotateCall.metadata).not.toHaveProperty('parameters');
    });

    it('handles spans without attributes gracefully', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({
        type: SpanType.GENERIC,
        metadata: { onlyMeta: true },
        attributes: undefined,
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      expect(mockAnnotate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          metadata: { onlyMeta: true },
        }),
      );
    });

    it('handles spans without metadata or attributes', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({
        type: SpanType.GENERIC,
        metadata: undefined,
        attributes: undefined,
      });

      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      // Should still call trace but annotations should not include empty metadata
      expect(mockTrace).toHaveBeenCalled();
      const annotateCall = mockAnnotate.mock.calls[0]?.[1];
      // If metadata is included, it should not be an empty object
      if (annotateCall?.metadata) {
        expect(Object.keys(annotateCall.metadata).length).toBeGreaterThan(0);
      }
    });
  });

  describe('timer cancellation on new activity', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('cancels cleanup timer when new span arrives for same trace', async () => {
      const exporter = new DatadogExporter({ mlApp: 'test', apiKey: 'test-key' });

      const rootSpan = createMockSpan({
        id: 'root',
        traceId: 'trace-reactivate',
        isRootSpan: true,
      });

      // Start and end root span to trigger cleanup timer
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, rootSpan));
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, rootSpan));

      // Timer should be scheduled
      let state = (exporter as any).traceState.get('trace-reactivate');
      expect(state?.cleanupTimer).toBeDefined();

      // Advance time partially (not full 60s)
      await vi.advanceTimersByTimeAsync(30_000);

      // State should still exist
      expect((exporter as any).traceState.has('trace-reactivate')).toBe(true);

      // New late span arrives
      const lateChild = createMockSpan({
        id: 'late-child',
        traceId: 'trace-reactivate',
        isRootSpan: false,
        parentSpanId: 'root',
      });
      await exporter.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, lateChild));

      // Timer should have been canceled and reset
      state = (exporter as any).traceState.get('trace-reactivate');
      // The late child should have been emitted and a new timer scheduled
      expect(mockTrace).toHaveBeenCalledTimes(2);

      // Complete the full 60s from the new timer
      await vi.advanceTimersByTimeAsync(60_000);

      // Now state should be cleaned up
      expect((exporter as any).traceState.has('trace-reactivate')).toBe(false);
    });
  });
});
