/**
 * Tests for Datadog Bridge
 *
 * Uses mock dd-trace to verify that the bridge keeps a single eager dd span
 * per Mastra span lifecycle and does not create a second synthetic span tree
 * via llmobs.trace().
 */

/// <reference types="node" />

import type {
  TracingEvent,
  AnyExportedSpan,
  CreateSpanOptions,
  SpanType as SpanTypeGeneric,
} from '@mastra/core/observability';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  capturedApmSpans,
  llmobsRegistrations,
  mockAnnotate,
  mockDisable,
  mockEnable,
  mockExporterFlush,
  mockFlush,
  mockInit,
  mockLlmobsActivate,
  mockScopeActivate,
  mockScopeActive,
  mockStartSpan,
  mockTrace,
} = vi.hoisted(() => {
  let currentScopeSpan: any = undefined;
  let apmSpanCounter = 0;
  let rootTraceCounter = 0;

  const apmSpans: any[] = [];
  const registrations: Array<{ span: any; options: any }> = [];

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

  const llmobsActivate = vi.fn((span: any, _options: any, fn: () => any) => fn());

  const startSpan = vi.fn((name: string, options?: any) => {
    apmSpanCounter++;

    const parent = options?.childOf;
    const spanHex = apmSpanCounter.toString(16).padStart(16, '0');
    const traceHex = parent?.context?.()?.toTraceId?.(true) ?? (++rootTraceCounter).toString(16).padStart(32, '0');

    const span = {
      _name: name,
      _options: options,
      finish: vi.fn(),
      setTag: vi.fn(),
      context: vi.fn(() => ({
        toSpanId: (_hex?: boolean) => spanHex,
        toTraceId: (_hex?: boolean) => traceHex,
      })),
    };

    apmSpans.push(span);
    return span;
  });

  return {
    capturedApmSpans: apmSpans,
    llmobsRegistrations: registrations,
    mockAnnotate: vi.fn(),
    mockDisable: vi.fn(),
    mockEnable: vi.fn(),
    mockExporterFlush: vi.fn((done?: (error?: unknown) => void) => done?.()),
    mockFlush: vi.fn().mockResolvedValue(undefined),
    mockInit: vi.fn(),
    mockLlmobsActivate: llmobsActivate,
    mockScopeActivate: activate,
    mockScopeActive: active,
    mockStartSpan: startSpan,
    mockTrace: vi.fn(),
  };
});

vi.mock('dd-trace', () => {
  const mockTagger = {
    registerLLMObsSpan: vi.fn((span: any, options: any) => {
      llmobsRegistrations.push({ span, options });
    }),
  };

  return {
    default: {
      init: mockInit,
      startSpan: mockStartSpan,
      llmobs: {
        _tagger: mockTagger,
        _activate: mockLlmobsActivate,
        enable: mockEnable,
        disable: mockDisable,
        annotate: mockAnnotate,
        flush: mockFlush,
        trace: mockTrace,
      },
      _tracer: {
        started: false,
        _exporter: {
          flush: mockExporterFlush,
        },
      },
      scope: () => ({
        activate: mockScopeActivate,
        active: mockScopeActive,
      }),
    },
  };
});

import { DatadogBridge } from './bridge';

function createMockSpan(overrides: Partial<AnyExportedSpan> = {}): AnyExportedSpan {
  return {
    id: '0000000000000001',
    traceId: '00000000000000000000000000000001',
    name: 'test-span',
    type: SpanType.GENERIC,
    startTime: new Date('2024-01-01T00:00:00Z'),
    endTime: new Date('2024-01-01T00:00:01Z'),
    isEvent: false,
    isRootSpan: true,
    ...overrides,
  } as AnyExportedSpan;
}

function createTracingEvent(type: TracingEventType, span: AnyExportedSpan): TracingEvent {
  return { type, exportedSpan: span } as TracingEvent;
}

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
    capturedApmSpans.length = 0;
    llmobsRegistrations.length = 0;
    mockExporterFlush.mockImplementation((done?: (error?: unknown) => void) => done?.());
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
  });

  describe('createSpan', () => {
    it('creates a single eager APM span and returns dd-trace ids', () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      const result = bridge.createSpan(createMockSpanOptions({ name: 'my-agent' }));

      expect(mockStartSpan).toHaveBeenCalledWith('my-agent', expect.any(Object));
      expect(result).toEqual({
        spanId: '0000000000000001',
        traceId: '00000000000000000000000000000001',
        parentSpanId: undefined,
      });
    });

    it('registers the eager span with the LLMObs tagger', () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      bridge.createSpan(createMockSpanOptions({ name: 'my-agent', type: SpanType.AGENT_RUN as SpanTypeGeneric }));

      expect(llmobsRegistrations).toHaveLength(1);
      expect(llmobsRegistrations[0]?.options).toMatchObject({
        kind: 'agent',
        name: 'my-agent',
      });
      expect(mockTrace).not.toHaveBeenCalled();
    });

    it('propagates trace-level user and session context from the root span to descendants', () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      const rootResult = bridge.createSpan(
        createMockSpanOptions({
          name: 'root',
          metadata: {
            userId: 'user-123',
            sessionId: 'session-456',
          },
        }),
      )!;

      bridge.createSpan(
        createMockSpanOptions({
          name: 'child',
          parent: {
            id: rootResult.spanId,
            traceId: rootResult.traceId,
            isInternal: false,
            metadata: {},
            getParentSpanId: () => undefined,
          } as any,
        }),
      );

      expect(llmobsRegistrations[1]?.options).toMatchObject({
        userId: 'user-123',
        sessionId: 'session-456',
      });
    });

    it('uses the parent dd span when creating a child span', () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      const parentResult = bridge.createSpan(createMockSpanOptions({ name: 'parent' }))!;
      const parentApmSpan = capturedApmSpans[0];
      const mockParent = {
        id: parentResult.spanId,
        traceId: parentResult.traceId,
        isInternal: false,
        metadata: {},
        getParentSpanId: () => undefined,
      };

      const childResult = bridge.createSpan(
        createMockSpanOptions({
          name: 'child',
          parent: mockParent as any,
        }),
      )!;

      expect(childResult.parentSpanId).toBe(parentResult.spanId);
      expect(childResult.traceId).toBe(parentResult.traceId);
      expect(capturedApmSpans[1]._options).toEqual({ childOf: parentApmSpan });
      expect(llmobsRegistrations[1]?.options.parent).toBe(parentApmSpan);
    });

    it('falls back to the active dd-trace scope when no explicit parent exists', () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      const requestSpan = {
        context: () => ({
          toSpanId: () => 'aaaaaaaaaaaaaaaa',
          toTraceId: () => 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        }),
      };
      mockScopeActive.mockReturnValueOnce(requestSpan);

      const result = bridge.createSpan(createMockSpanOptions())!;

      expect(mockStartSpan).toHaveBeenCalledWith('test-span', { childOf: requestSpan });
      expect(result.parentSpanId).toBe('aaaaaaaaaaaaaaaa');
      expect(result.traceId).toBe('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
      expect(llmobsRegistrations[0]?.options.parent).toBeUndefined();
    });

    it('falls back to the active distributed dd-trace scope when an explicit external parent is missing from the bridge map', () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      const requestSpan = {
        context: () => ({
          toSpanId: () => 'aaaaaaaaaaaaaaaa',
          toTraceId: () => 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        }),
      };
      mockScopeActive.mockReturnValueOnce(requestSpan);

      const result = bridge.createSpan(
        createMockSpanOptions({
          parent: {
            id: 'missing-parent-id',
            traceId: 'cccccccccccccccccccccccccccccccc',
            isInternal: false,
            metadata: {},
            getParentSpanId: () => undefined,
          } as any,
        }),
      )!;

      expect(mockStartSpan).toHaveBeenCalledWith('test-span', { childOf: requestSpan });
      expect(result.parentSpanId).toBe('aaaaaaaaaaaaaaaa');
      expect(result.traceId).toBe('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
      expect(llmobsRegistrations[0]?.options.parent).toBe(requestSpan);
    });

    it('uses the distributed APM parent for LLMObs when an external parent exists but is not in the local bridge map', () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      const distributedParent = {
        context: () => ({
          toSpanId: () => 'aaaaaaaaaaaaaaaa',
          toTraceId: () => 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        }),
      };
      mockScopeActive.mockReturnValueOnce(distributedParent);

      bridge.createSpan(
        createMockSpanOptions({
          parent: {
            id: 'missing-parent-id',
            traceId: 'cccccccccccccccccccccccccccccccc',
            isInternal: false,
            metadata: {},
            getParentSpanId: () => undefined,
          } as any,
        }),
      )!;

      expect(llmobsRegistrations[0]?.options.parent).toBe(distributedParent);
    });

    it('inherits model info for MODEL_STEP spans from a MODEL_GENERATION parent when needed', () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      bridge.createSpan(
        createMockSpanOptions({
          name: 'step',
          type: SpanType.MODEL_STEP as SpanTypeGeneric,
          parent: {
            id: 'gen-id',
            traceId: 'gen-trace',
            type: SpanType.MODEL_GENERATION,
            isInternal: false,
            metadata: {},
            attributes: { model: 'gpt-5.4', provider: 'openai' },
            getParentSpanId: () => undefined,
          } as any,
        }),
      );

      expect(llmobsRegistrations[0]?.options).toMatchObject({
        kind: 'llm',
        modelName: 'gpt-5.4',
        modelProvider: 'openai',
      });
    });
  });

  describe('executeInContext', () => {
    it('activates the eager dd span in scope for async functions', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });
      const spanResult = bridge.createSpan(createMockSpanOptions())!;
      const apmSpan = capturedApmSpans[0];

      await bridge.executeInContext(spanResult.spanId, async () => {});

      expect(mockScopeActivate).toHaveBeenCalledWith(apmSpan, expect.any(Function));
      expect(mockLlmobsActivate).toHaveBeenCalledWith(apmSpan, undefined, expect.any(Function));
    });

    it('activates the eager dd span in scope for sync functions', () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });
      const spanResult = bridge.createSpan(createMockSpanOptions())!;
      const apmSpan = capturedApmSpans[0];

      bridge.executeInContextSync(spanResult.spanId, () => {});

      expect(mockScopeActivate).toHaveBeenCalledWith(apmSpan, expect.any(Function));
      expect(mockLlmobsActivate).toHaveBeenCalledWith(apmSpan, undefined, expect.any(Function));
    });

    it('falls back to direct execution when the span is not in the map', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      const result = await bridge.executeInContext('nonexistent-span', async () => 42);

      expect(result).toBe(42);
      expect(mockScopeActivate).not.toHaveBeenCalled();
    });

    it('falls back to direct sync execution when the span is not in the map', () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      const result = bridge.executeInContextSync('nonexistent-span', () => 42);

      expect(result).toBe(42);
      expect(mockScopeActivate).not.toHaveBeenCalled();
    });
  });

  describe('span lifecycle', () => {
    it('annotates and finishes the eager dd span on span_ended', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });
      const spanResult = bridge.createSpan(createMockSpanOptions())!;
      const apmSpan = capturedApmSpans[0];

      const span = createMockSpan({
        id: spanResult.spanId,
        traceId: spanResult.traceId,
        input: 'hello',
        output: 'world',
      });

      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      expect(mockAnnotate).toHaveBeenCalledWith(
        apmSpan,
        expect.objectContaining({
          inputData: 'hello',
          outputData: 'world',
        }),
      );
      expect(apmSpan.finish).toHaveBeenCalledWith(span.endTime!.getTime());
      expect(mockTrace).not.toHaveBeenCalled();
    });

    it('annotates and finishes event spans on span_started', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });
      const spanResult = bridge.createSpan(createMockSpanOptions())!;
      const apmSpan = capturedApmSpans[0];

      const startTime = new Date('2024-01-01T00:00:00Z');
      const eventSpan = createMockSpan({
        id: spanResult.spanId,
        traceId: spanResult.traceId,
        isEvent: true,
        startTime,
        endTime: undefined,
      });

      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_STARTED, eventSpan));

      expect(apmSpan.finish).toHaveBeenCalledWith(startTime.getTime());
      expect(mockTrace).not.toHaveBeenCalled();
    });

    it('annotates and finishes event spans on span_ended', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });
      const spanResult = bridge.createSpan(createMockSpanOptions())!;
      const apmSpan = capturedApmSpans[0];

      const endTime = new Date('2024-01-01T00:00:05Z');
      const eventSpan = createMockSpan({
        id: spanResult.spanId,
        traceId: spanResult.traceId,
        isEvent: true,
        output: 'tool-result',
        endTime,
      });

      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, eventSpan));

      expect(mockAnnotate).toHaveBeenCalledWith(
        apmSpan,
        expect.objectContaining({
          outputData: 'tool-result',
        }),
      );
      expect(apmSpan.finish).toHaveBeenCalledWith(endTime.getTime());
      expect(mockTrace).not.toHaveBeenCalled();
    });

    it('sets native Datadog error tags before finishing', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });
      const spanResult = bridge.createSpan(createMockSpanOptions())!;
      const apmSpan = capturedApmSpans[0];

      const span = createMockSpan({
        id: spanResult.spanId,
        traceId: spanResult.traceId,
        errorInfo: {
          message: 'Something went wrong',
          name: 'ValidationError',
          stack: 'ValidationError: Something went wrong',
        },
      });

      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      expect(apmSpan.setTag).toHaveBeenCalledWith('error', true);
      expect(apmSpan.setTag).toHaveBeenCalledWith('error.message', 'Something went wrong');
      expect(apmSpan.setTag).toHaveBeenCalledWith('error.type', 'ValidationError');
    });

    it('still finishes the eager dd span when LLMObs annotation throws', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });
      const spanResult = bridge.createSpan(createMockSpanOptions())!;
      const apmSpan = capturedApmSpans[0];

      mockAnnotate.mockImplementationOnce(() => {
        throw new Error('annotation failed');
      });

      const span = createMockSpan({
        id: spanResult.spanId,
        traceId: spanResult.traceId,
        input: { prompt: 'hello' },
      });

      await bridge.exportTracingEvent(createTracingEvent(TracingEventType.SPAN_ENDED, span));

      expect(mockAnnotate).toHaveBeenCalled();
      expect(apmSpan.finish).toHaveBeenCalledWith(span.endTime!.getTime());
    });

    it('promotes requestContextKeys to flat LLMObs tags during annotation', async () => {
      const bridge = new DatadogBridge({
        mlApp: 'test',
        agentless: false,
        requestContextKeys: ['tenantId'],
      });
      const spanResult = bridge.createSpan(createMockSpanOptions())!;

      const span = createMockSpan({
        id: spanResult.spanId,
        traceId: spanResult.traceId,
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

    it('releases stored trace context after the last span in a trace finishes', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      const rootResult = bridge.createSpan(
        createMockSpanOptions({
          name: 'root',
          metadata: {
            userId: 'user-123',
            sessionId: 'session-456',
          },
        }),
      )!;

      await bridge.exportTracingEvent(
        createTracingEvent(
          TracingEventType.SPAN_ENDED,
          createMockSpan({
            id: rootResult.spanId,
            traceId: rootResult.traceId,
          }),
        ),
      );

      expect(bridge['traceContext'].size).toBe(0);
      expect(bridge['openSpanCounts'].size).toBe(0);
    });
  });

  describe('shutdown', () => {
    it('force-finishes remaining spans on shutdown', async () => {
      const bridge = new DatadogBridge({ mlApp: 'test', agentless: false });

      bridge.createSpan(createMockSpanOptions({ name: 'orphan-1' }));
      bridge.createSpan(createMockSpanOptions({ name: 'orphan-2' }));

      await bridge.shutdown();

      expect(capturedApmSpans[0].finish).toHaveBeenCalled();
      expect(capturedApmSpans[1].finish).toHaveBeenCalled();
      expect(mockExporterFlush).toHaveBeenCalled();
      expect(mockDisable).toHaveBeenCalled();
    });
  });
});
