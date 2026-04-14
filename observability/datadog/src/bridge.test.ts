/**
 * Tests for Datadog Bridge
 *
 * Uses mock dd-trace to test the bridge without connecting to Datadog.
 */

/// <reference types="node" />

import type {
  TracingEvent,
  AnyExportedSpan,
  CreateSpanOptions,
  SpanType as SpanTypeGeneric,
} from '@mastra/core/observability';
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
  mockStartSpan,
  mockScopeActivate,
  mockScopeActive,
  traceParents,
  capturedLLMObsSpans,
  capturedAPMSpans,
} = vi.hoisted(() => {
  let currentScopeSpan: any = undefined;
  const parents: any[] = [];
  const llmobsSpans: any[] = [];
  let apmSpanCounter = 0;

  const activate = vi.fn((span: any, fn: () => any) => {
    const previous = currentScopeSpan;
    currentScopeSpan = span;
    try {
      return fn();
    } finally {
      currentScopeSpan = previous;
    }
  });

  const active = vi.fn(() => currentScopeSpan);

  const apmSpans: any[] = [];

  return {
    traceParents: parents,
    capturedLLMObsSpans: llmobsSpans,
    capturedAPMSpans: apmSpans,
    mockAnnotate: vi.fn(),
    mockTrace: vi.fn((options: any, fn: (span: any) => void) => {
      parents.push(currentScopeSpan);
      const ddSpan = {
        id: `mock-llmobs-span-${parents.length}`,
        options,
        setTag: vi.fn(),
        finish: vi.fn(),
      };
      llmobsSpans.push(ddSpan);
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
    mockStartSpan: vi.fn((name: string, options?: any) => {
      apmSpanCounter++;
      const span = {
        id: `mock-apm-span-${apmSpanCounter}`,
        _name: name,
        _options: options,
        finish: vi.fn(),
        setTag: vi.fn(),
        context: vi.fn(() => ({
          toSpanId: () => `apm-span-id-${apmSpanCounter}`,
          toTraceId: () => `apm-trace-id-${apmSpanCounter}`,
        })),
      };
      apmSpans.push(span);
      return span;
    }),
    mockScopeActivate: activate,
    mockScopeActive: active,
  };
});

// Mock dd-trace before importing the bridge
vi.mock('dd-trace', () => {
  return {
    default: {
      init: mockInit,
      startSpan: mockStartSpan,
      llmobs: {
        enable: mockEnable,
        disable: mockDisable,
        trace: mockTrace,
        annotate: mockAnnotate,
        flush: mockFlush,
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

import { DatadogBridge } from './bridge';

/**
 * Creates a mock span with default values
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

/**
 * Creates mock CreateSpanOptions for bridge.createSpan() testing
 */
function createMockSpanOptions(
  overrides: Partial<CreateSpanOptions<SpanTypeGeneric>> = {},
): CreateSpanOptions<SpanTypeGeneric> {
  return {
    name: 'test-span',
    type: SpanType.GENERIC as SpanTypeGeneric,
    ...overrides,
  } as CreateSpanOptions<SpanTypeGeneric>;
}

describe('DatadogBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    traceParents.length = 0;
    capturedLLMObsSpans.length = 0;
    capturedAPMSpans.length = 0;
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
      const bridge = new DatadogBridge({
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
      expect(bridge.name).toBe('datadog-bridge');
    });

    it('disables bridge when mlApp is missing', () => {
      const bridge = new DatadogBridge({});
      expect(mockEnable).not.toHaveBeenCalled();
      expect(bridge['isDisabled']).toBe(true);
    });

    it('disables bridge when agentless mode lacks apiKey', () => {
      const bridge = new DatadogBridge({
        mlApp: 'test-app',
        agentless: true,
      });
      expect(mockEnable).not.toHaveBeenCalled();
      expect(bridge['isDisabled']).toBe(true);
    });

    it('allows non-agentless mode without apiKey', () => {
      const bridge = new DatadogBridge({
        mlApp: 'test-app',
        agentless: false,
      });

      expect(bridge['isDisabled']).toBe(false);
    });

    it('reads configuration from environment variables', () => {
      process.env.DD_LLMOBS_ML_APP = 'env-app';
      process.env.DD_API_KEY = 'env-key';

      const bridge = new DatadogBridge({});

      expect(bridge['isDisabled']).toBe(false);
    });

    it('defaults agentless to false (assumes local Datadog Agent)', () => {
      const bridge = new DatadogBridge({ mlApp: 'test-app' });

      // Bridge does not require apiKey because agentless defaults to false
      expect(bridge['isDisabled']).toBe(false);
    });

    it('respects DD_LLMOBS_AGENTLESS_ENABLED=true env var', () => {
      process.env.DD_LLMOBS_AGENTLESS_ENABLED = 'true';

      // Without apiKey, agentless mode should disable the bridge
      const bridge = new DatadogBridge({ mlApp: 'test-app' });

      expect(bridge['isDisabled']).toBe(true);
    });

    it('prefers config values over environment variables', () => {
      process.env.DD_LLMOBS_ML_APP = 'env-app';

      const bridge = new DatadogBridge({
        mlApp: 'config-app',
        agentless: false,
      });

      expect(bridge['isDisabled']).toBe(false);
      expect(bridge['config'].mlApp).toBe('config-app');
    });
  });

  describe('createSpan', () => {
    it('creates an APM span via tracer.startSpan()', () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      const result = bridge.createSpan(createMockSpanOptions({ name: 'my-agent' }));

      expect(result).toBeDefined();
      expect(result!.spanId).toBeDefined();
      expect(result!.traceId).toBeDefined();
      expect(mockStartSpan).toHaveBeenCalledWith('my-agent', expect.any(Object));
    });

    it('returns hex-format span and trace IDs', () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      const result = bridge.createSpan(createMockSpanOptions());

      expect(result!.spanId).toMatch(/^[0-9a-f]{16}$/);
      expect(result!.traceId).toMatch(/^[0-9a-f]{32}$/);
    });

    it('sets parent from getExternalParentId when parent span exists in map', () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      // Create parent span first
      const parentResult = bridge.createSpan(createMockSpanOptions({ name: 'parent' }));
      const parentApmSpan = capturedAPMSpans[0];

      // Create child span with parent reference
      const mockParent = {
        id: parentResult!.spanId,
        traceId: parentResult!.traceId,
        isInternal: false,
        getParentSpanId: () => undefined,
      };

      const childResult = bridge.createSpan(
        createMockSpanOptions({
          name: 'child',
          parent: mockParent as any,
        }),
      );

      expect(childResult).toBeDefined();
      expect(childResult!.parentSpanId).toBe(parentResult!.spanId);
      expect(childResult!.traceId).toBe(parentResult!.traceId);
      // The child's APM span should have been created with childOf pointing to parent
      expect(mockStartSpan).toHaveBeenCalledTimes(2);
      expect(capturedAPMSpans[1]._options).toEqual({ childOf: parentApmSpan });
    });

    it('falls back to active dd-trace scope when no explicit parent', () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      // Simulate an active request span in dd-trace scope
      const requestSpan = { id: 'request-span' };
      mockScopeActive.mockReturnValueOnce(requestSpan);

      const result = bridge.createSpan(createMockSpanOptions());

      expect(result).toBeDefined();
      expect(mockStartSpan).toHaveBeenCalledWith('test-span', { childOf: requestSpan });
    });

    it('returns undefined when bridge is disabled', () => {
      const bridge = new DatadogBridge({}); // Missing mlApp

      const result = bridge.createSpan(createMockSpanOptions());

      expect(result).toBeUndefined();
    });
  });

  describe('executeInContext', () => {
    it('activates dd-trace span in scope for async functions', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      // Create a span to get it in the map
      const spanResult = bridge.createSpan(createMockSpanOptions());
      const apmSpan = capturedAPMSpans[0];

      await bridge.executeInContext(spanResult!.spanId, async () => {
        // function runs within activated scope
      });

      expect(mockScopeActivate).toHaveBeenCalledWith(apmSpan, expect.any(Function));
    });

    it('activates dd-trace span in scope for sync functions', () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      const spanResult = bridge.createSpan(createMockSpanOptions());
      const apmSpan = capturedAPMSpans[0];

      bridge.executeInContextSync(spanResult!.spanId, () => 'result');

      expect(mockScopeActivate).toHaveBeenCalledWith(apmSpan, expect.any(Function));
    });

    it('falls back to direct execution when span not in map', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      const result = await bridge.executeInContext('nonexistent-span', async () => 42);

      expect(result).toBe(42);
      expect(mockScopeActivate).not.toHaveBeenCalled();
    });

    it('returns function result through scope activation', () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });
      const spanResult = bridge.createSpan(createMockSpanOptions());

      const result = bridge.executeInContextSync(spanResult!.spanId, () => 'hello');

      expect(result).toBe('hello');
    });
  });

  describe('APM span lifecycle', () => {
    it('finishes APM span on span_ended with correct timestamp', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      const spanResult = bridge.createSpan(createMockSpanOptions());
      const apmSpan = capturedAPMSpans[0];

      const endTime = new Date('2024-01-01T00:00:05Z');
      const span = createMockSpan({
        id: spanResult!.spanId,
        traceId: spanResult!.traceId,
        endTime,
      });

      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      expect(apmSpan.finish).toHaveBeenCalledWith(endTime.getTime());
    });

    it('removes APM span from map after finishing', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      const spanResult = bridge.createSpan(createMockSpanOptions());

      const span = createMockSpan({
        id: spanResult!.spanId,
        traceId: spanResult!.traceId,
      });

      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      // Verify span is removed by checking executeInContext falls through
      const result = bridge.executeInContextSync(spanResult!.spanId, () => 'test');
      expect(result).toBe('test');
      expect(mockScopeActivate).not.toHaveBeenCalled();
    });

    it('finishes APM span for event spans on span_started', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      const spanResult = bridge.createSpan(createMockSpanOptions());

      const startTime = new Date('2024-01-01T00:00:00Z');
      const eventSpan = createMockSpan({
        id: spanResult!.spanId,
        traceId: spanResult!.traceId,
        isEvent: true,
        isRootSpan: true,
        startTime,
        endTime: undefined,
      });

      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, eventSpan));

      // APM span should be finished with startTime (zero duration)
      const apmSpan = capturedAPMSpans[0];
      expect(apmSpan.finish).toHaveBeenCalledWith(startTime.getTime());
    });
  });

  describe('LLMObs emission', () => {
    it('emits LLMObs span via llmobs.trace() on span_ended', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });
      const span = createMockSpan({ name: 'test-operation' });

      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      expect(mockTrace).toHaveBeenCalledWith(expect.objectContaining({ name: 'test-operation' }), expect.any(Function));
    });

    it('does not emit on span_started for regular spans', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });
      const span = createMockSpan({ isRootSpan: true });

      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, span));

      expect(mockTrace).not.toHaveBeenCalled();
    });

    it('ignores span_updated events', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });
      const span = createMockSpan();

      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_UPDATED, span));

      expect(mockTrace).not.toHaveBeenCalled();
    });

    it('captures trace context and applies to all spans', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

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

      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, rootSpan));
      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, childSpan));
      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, rootSpan));

      expect(mockTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          sessionId: 'session-1',
        }),
        expect.any(Function),
      );
    });

    it('emits parent-child hierarchy using nested llmobs.trace() calls', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      const rootSpan = createMockSpan({ id: 'root', traceId: 'trace-1', isRootSpan: true });
      const childSpan = createMockSpan({
        id: 'child',
        traceId: 'trace-1',
        isRootSpan: false,
        parentSpanId: 'root',
      });

      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, childSpan));
      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, rootSpan));

      expect(mockTrace).toHaveBeenCalledTimes(2);
      // Root has no parent in scope
      expect(traceParents[0]).toBeUndefined();
      // Child is emitted inside root's callback, so root's LLMObs span is the parent
      expect(traceParents[1]).toEqual(expect.objectContaining({ id: 'mock-llmobs-span-1' }));
    });

    it('handles late-arriving spans after tree emission', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      const rootSpan = createMockSpan({ id: 'root', traceId: 'trace-late', isRootSpan: true });
      const childSpan = createMockSpan({
        id: 'child',
        traceId: 'trace-late',
        isRootSpan: false,
        parentSpanId: 'root',
      });

      // Root ends first (triggers tree emission with just root)
      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, rootSpan));
      expect(mockTrace).toHaveBeenCalledTimes(1);

      // Child arrives late
      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, childSpan));
      expect(mockTrace).toHaveBeenCalledTimes(2);
      // Late-arriving span uses scope().activate() with parent context
      expect(mockScopeActivate).toHaveBeenCalled();
    });

    it('preserves unresolved children when root ends before their parent', async () => {
      // Scenario:
      // 1. child ends (buffered; its parent hasn't ended yet)
      // 2. root ends → tree is built, but child's parent isn't in the buffer
      //    so child is "orphan" during initial tree emission
      // 3. parent ends later → parent emits (parent's parent is root, in contexts)
      // 4. child should then also emit (its parent is now in contexts)
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      const rootSpan = createMockSpan({ id: 'root', traceId: 'trace-orphan', isRootSpan: true });
      const parentSpan = createMockSpan({
        id: 'parent',
        traceId: 'trace-orphan',
        isRootSpan: false,
        parentSpanId: 'root',
      });
      const childSpan = createMockSpan({
        id: 'child',
        traceId: 'trace-orphan',
        isRootSpan: false,
        parentSpanId: 'parent',
      });

      // 1. Child ends first (buffered, parent not yet in buffer)
      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, childSpan));
      expect(mockTrace).not.toHaveBeenCalled();

      // 2. Root ends (triggers tree emission — only root is resolvable)
      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, rootSpan));
      // Root emits, child stays buffered (its parent is not in contexts yet)
      expect(mockTrace).toHaveBeenCalledTimes(1);

      // 3. Parent ends late
      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, parentSpan));
      // Parent and child both emit now
      expect(mockTrace).toHaveBeenCalledTimes(3);
    });
  });

  describe('model attribute inheritance for late-arriving spans', () => {
    it('passes MODEL_GENERATION model/provider to a late-arriving MODEL_STEP child', async () => {
      // Scenario: a MODEL_STEP child arrives after its MODEL_GENERATION parent
      // has already been emitted as part of the tree. The late-arrival path
      // should look up the parent's stored childInheritedModelAttrs and pass
      // them to buildSpanOptions so the LLM-kind span has modelName/modelProvider.
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      const rootSpan = createMockSpan({
        id: 'root',
        traceId: 'trace-model-late',
        isRootSpan: true,
        type: SpanType.AGENT_RUN,
      });
      const genSpan = createMockSpan({
        id: 'gen',
        traceId: 'trace-model-late',
        isRootSpan: false,
        parentSpanId: 'root',
        type: SpanType.MODEL_GENERATION,
        attributes: { model: 'gpt-5.4', provider: 'openai' },
      });
      const stepSpan = createMockSpan({
        id: 'step',
        traceId: 'trace-model-late',
        isRootSpan: false,
        parentSpanId: 'gen',
        type: SpanType.MODEL_STEP,
      });

      // Emit tree first: root + gen (step hasn't ended yet)
      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, genSpan));
      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, rootSpan));

      // Now the late-arriving step
      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, stepSpan));

      // Find the LLMObs trace call for the step span (kind: 'llm')
      const stepCall = mockTrace.mock.calls.find(([opts]: any) => opts.kind === 'llm');
      expect(stepCall).toBeDefined();
      expect(stepCall![0]).toMatchObject({
        kind: 'llm',
        modelName: 'gpt-5.4',
        modelProvider: 'openai',
      });
    });
  });

  describe('span type mapping', () => {
    it.each([
      [SpanType.AGENT_RUN, 'agent'],
      [SpanType.MODEL_GENERATION, 'workflow'],
      [SpanType.MODEL_STEP, 'llm'],
      [SpanType.TOOL_CALL, 'tool'],
      [SpanType.MCP_TOOL_CALL, 'tool'],
      [SpanType.WORKFLOW_RUN, 'workflow'],
      [SpanType.GENERIC, 'task'],
    ])('maps %s to %s kind in LLMObs', async (spanType, expectedKind) => {
      const bridge = new DatadogBridge({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({ type: spanType });

      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      expect(mockTrace).toHaveBeenCalledWith(expect.objectContaining({ kind: expectedKind }), expect.any(Function));
    });
  });

  describe('annotations', () => {
    it('annotates with input and output', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({
        input: 'hello',
        output: 'world',
      });

      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      expect(mockAnnotate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          inputData: 'hello',
          outputData: 'world',
        }),
      );
    });

    it('includes error tags and metadata for error spans', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({
        errorInfo: {
          message: 'Something went wrong',
          name: 'ValidationError',
          stack: 'ValidationError: Something went wrong\n    at test.ts:1:1',
        },
      });

      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      // Verify LLMObs error tags
      const ddSpan = capturedLLMObsSpans[0];
      expect(ddSpan.setTag).toHaveBeenCalledWith('error', true);
      expect(ddSpan.setTag).toHaveBeenCalledWith('error.message', 'Something went wrong');
      expect(ddSpan.setTag).toHaveBeenCalledWith('error.type', 'ValidationError');

      // Verify error in annotations
      expect(mockAnnotate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          metadata: expect.objectContaining({
            'error.message': 'Something went wrong',
          }),
          tags: expect.objectContaining({
            error: true,
          }),
        }),
      );
    });

    it('includes token metrics on MODEL_STEP spans', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', apiKey: 'test-key' });
      const span = createMockSpan({
        type: SpanType.MODEL_STEP,
        attributes: {
          usage: { inputTokens: 100, outputTokens: 50 },
        },
      });

      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      expect(mockAnnotate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          metrics: expect.objectContaining({
            inputTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
          }),
        }),
      );
    });

    it('promotes requestContextKeys to flat tags', async () => {
      const bridge = new DatadogBridge({
        mlApp: 'test',
        apiKey: 'test-key',
        requestContextKeys: ['tenantId'],
      });
      const span = createMockSpan({
        metadata: { tenantId: 'tenant-123', other: 'value' },
      });

      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      expect(mockAnnotate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          metadata: { other: 'value' },
          tags: { tenantId: 'tenant-123' },
        }),
      );
    });
  });

  describe('flush and shutdown', () => {
    it('flushes llmobs on flush()', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      await bridge.flush();

      expect(mockFlush).toHaveBeenCalled();
    });

    it('force-finishes remaining APM spans on shutdown', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      // Create spans but don't end them
      bridge.createSpan(createMockSpanOptions({ name: 'orphan-1' }));
      bridge.createSpan(createMockSpanOptions({ name: 'orphan-2' }));

      await bridge.shutdown();

      // Both APM spans should have been force-finished
      expect(capturedAPMSpans[0].finish).toHaveBeenCalled();
      expect(capturedAPMSpans[1].finish).toHaveBeenCalled();
    });

    it('disables llmobs on shutdown', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      await bridge.shutdown();

      expect(mockDisable).toHaveBeenCalled();
    });
  });

  describe('end-to-end: APM + LLMObs flow', () => {
    it('creates APM span eagerly and emits LLMObs on end', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      // 1. Bridge creates APM span eagerly
      const spanResult = bridge.createSpan(createMockSpanOptions({ name: 'agent-run' }));
      expect(mockStartSpan).toHaveBeenCalledWith('agent-run', expect.any(Object));
      expect(mockTrace).not.toHaveBeenCalled(); // No LLMObs yet

      // 2. During execution, scope is activated
      let scopeWasActivated = false;
      bridge.executeInContextSync(spanResult!.spanId, () => {
        scopeWasActivated = true;
      });
      expect(scopeWasActivated).toBe(true);
      expect(mockScopeActivate).toHaveBeenCalled();

      // 3. Span ends — APM span finished + LLMObs emitted
      const span = createMockSpan({
        id: spanResult!.spanId,
        traceId: spanResult!.traceId,
        name: 'agent-run',
        type: SpanType.AGENT_RUN,
        input: 'user message',
        output: 'agent response',
      });

      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      // APM span finished
      expect(capturedAPMSpans[0].finish).toHaveBeenCalled();

      // LLMObs span emitted with annotations
      expect(mockTrace).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'agent-run', kind: 'agent' }),
        expect.any(Function),
      );
      expect(mockAnnotate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          inputData: 'user message',
          outputData: 'agent response',
        }),
      );
    });
  });
});
