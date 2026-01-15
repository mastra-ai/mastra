/**
 * Unit tests using real Braintrust SDK to verify span nesting behavior.
 *
 * NOTE: We intentionally use the real SDK (not mocked) because we need to verify
 * the SDK's internal span relationship tracking (_spanId, _rootSpanId, _spanParents).
 * We use a fake API key ('test-key') so the SDK initializes and creates real span
 * objects with proper internal state, but no data is actually sent to Braintrust
 * servers. This runs at unit test speed with no external dependencies.
 *
 * These tests verify that our BraintrustExporter correctly uses the SDK's
 * startSpan() chain to establish proper parent-child relationships.
 *
 * Key behaviors tested:
 * 1. Root spans get _rootSpanId = own _spanId (no parentSpanIds passed)
 * 2. Child spans get correct _rootSpanId and _spanParents via startSpan() chain
 * 3. External context spans properly nest under external parent
 */

import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import { initLogger } from 'braintrust';
import type { Logger, Span } from 'braintrust';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { BraintrustExporter } from './tracing';

class TestBraintrustExporter extends BraintrustExporter {
  _getTraceData(traceId: string) {
    return this.getTraceData({ traceId, method: 'test' });
  }

  get _traceMapSize(): number {
    return this.traceMapSize();
  }

  get _isDisabled(): boolean {
    return this.isDisabled;
  }
}

// Helper to access internal Braintrust span properties
// These become root_span_id and span_parents in the Braintrust API
function getSpanInternals(span: Span | undefined) {
  expect(span).toBeDefined();
  return {
    spanId: (span as any)._spanId as string,
    rootSpanId: (span as any)._rootSpanId as string,
    spanParents: (span as any)._spanParents as string[] | undefined,
  };
}

// Helper to create mock Mastra spans for testing
function createMastraSpan(options: {
  id: string;
  name: string;
  type: SpanType;
  isRoot: boolean;
  parentSpanId?: string;
  traceId?: string;
  attributes?: Record<string, any>;
}): AnyExportedSpan {
  const traceId = options.traceId ?? (options.isRoot ? `${options.id}-trace` : 'shared-trace');
  return {
    id: options.id,
    name: options.name,
    type: options.type,
    attributes: options.attributes ?? {},
    metadata: {},
    startTime: new Date(),
    endTime: undefined,
    traceId,
    get isRootSpan() {
      return options.isRoot;
    },
    parentSpanId: options.parentSpanId,
    isEvent: false,
  } as AnyExportedSpan;
}

// =============================================================================
// Direct SDK Tests - Verify Braintrust SDK behavior
// =============================================================================

describe('Braintrust SDK - Direct startSpan() behavior', () => {
  let logger: Logger<true>;

  beforeAll(async () => {
    logger = await initLogger({
      projectName: 'test-sdk-direct',
      apiKey: 'test-key',
    });
  });

  it('logger.startSpan() without parentSpanIds auto-sets rootSpanId to itself', () => {
    const rootSpan = logger.startSpan({ name: 'root', type: 'task' });
    const root = getSpanInternals(rootSpan);

    expect(root.rootSpanId).toBe(root.spanId);
    expect(root.spanParents).toBeUndefined();

    rootSpan.end();
  });

  it('parentSpan.startSpan() chain sets correct rootSpanId and spanParents', () => {
    const rootSpan = logger.startSpan({ name: 'root', type: 'task' });
    const childSpan = rootSpan.startSpan({ name: 'child', type: 'llm' });
    const grandchildSpan = childSpan.startSpan({ name: 'grandchild', type: 'tool' });

    const root = getSpanInternals(rootSpan);
    const child = getSpanInternals(childSpan);
    const grandchild = getSpanInternals(grandchildSpan);

    // All share the same rootSpanId
    expect(root.rootSpanId).toBe(root.spanId);
    expect(child.rootSpanId).toBe(root.spanId);
    expect(grandchild.rootSpanId).toBe(root.spanId);

    // Each has correct immediate parent
    expect(root.spanParents).toBeUndefined();
    expect(child.spanParents).toEqual([root.spanId]);
    expect(grandchild.spanParents).toEqual([child.spanId]);

    grandchildSpan.end();
    childSpan.end();
    rootSpan.end();
  });
});

// =============================================================================
// Exporter Tests - Non-External Case
// =============================================================================

describe('BraintrustExporter - Non-External Case', () => {
  let logger: Logger<true>;
  let exporter: TestBraintrustExporter;

  beforeAll(async () => {
    logger = await initLogger({
      projectName: 'test-exporter-integration',
      apiKey: 'test-key',
    });
  });

  beforeEach(() => {
    exporter = new TestBraintrustExporter({
      braintrustLogger: logger,
    });
  });

  afterEach(async () => {
    await exporter.shutdown();
  });

  it('root span processed by exporter has correct rootSpanId = spanId', async () => {
    const mastraRoot = createMastraSpan({
      id: 'mastra-root-1',
      name: 'agent-run',
      type: SpanType.AGENT_RUN,
      isRoot: true,
      attributes: { agentId: 'test-agent' },
    });

    await exporter.exportTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: mastraRoot,
    });

    // Get the Braintrust span from the exporter's internal state
    const traceData = exporter._getTraceData(mastraRoot.traceId);

    // getSpan() returns BraintrustSpanData, access .span for the underlying Braintrust Span
    const spanData = traceData.getSpan({ spanId: mastraRoot.id });
    expect(spanData).toBeDefined();

    const internals = getSpanInternals(spanData!.span);

    // Root span should have rootSpanId = its own spanId
    expect(internals.rootSpanId).toBe(internals.spanId);
    expect(internals.spanParents).toBeUndefined();
  });

  it('child spans processed by exporter have correct parent chain', async () => {
    // Create Mastra span hierarchy
    const mastraRoot = createMastraSpan({
      id: 'root-span',
      name: 'agent-run',
      type: SpanType.AGENT_RUN,
      isRoot: true,
    });

    const mastraLlm = createMastraSpan({
      id: 'llm-span',
      name: 'llm-call',
      type: SpanType.MODEL_GENERATION,
      isRoot: false,
      parentSpanId: 'root-span',
      traceId: mastraRoot.traceId,
      attributes: { model: 'gpt-4' },
    });

    const mastraTool = createMastraSpan({
      id: 'tool-span',
      name: 'tool-call',
      type: SpanType.TOOL_CALL,
      isRoot: false,
      parentSpanId: 'llm-span',
      traceId: mastraRoot.traceId,
      attributes: { toolId: 'calculator' },
    });

    // Process spans through exporter
    await exporter.exportTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: mastraRoot,
    });
    await exporter.exportTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: mastraLlm,
    });
    await exporter.exportTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: mastraTool,
    });

    // Get Braintrust spans from exporter
    // getSpan() returns BraintrustSpanData, access .span for the underlying Braintrust Span
    const traceData = exporter._getTraceData(mastraRoot.traceId);
    const rootBt = traceData.getSpan({ spanId: 'root-span' })!.span;
    const llmBt = traceData.getSpan({ spanId: 'llm-span' })!.span;
    const toolBt = traceData.getSpan({ spanId: 'tool-span' })!.span;

    const root = getSpanInternals(rootBt);
    const llm = getSpanInternals(llmBt);
    const tool = getSpanInternals(toolBt);

    // All should share the same rootSpanId (the root's spanId)
    expect(root.rootSpanId).toBe(root.spanId);
    expect(llm.rootSpanId).toBe(root.spanId);
    expect(tool.rootSpanId).toBe(root.spanId);

    // Each should have correct immediate parent
    expect(root.spanParents).toBeUndefined();
    expect(llm.spanParents).toEqual([root.spanId]);
    expect(tool.spanParents).toEqual([llm.spanId]);
  });

  it('deeply nested spans (4 levels) have correct parent chain', async () => {
    const traceId = 'deep-trace';

    const spans = [
      createMastraSpan({ id: 'l1', name: 'level1', type: SpanType.AGENT_RUN, isRoot: true, traceId }),
      createMastraSpan({
        id: 'l2',
        name: 'level2',
        type: SpanType.MODEL_GENERATION,
        isRoot: false,
        parentSpanId: 'l1',
        traceId,
      }),
      createMastraSpan({
        id: 'l3',
        name: 'level3',
        type: SpanType.TOOL_CALL,
        isRoot: false,
        parentSpanId: 'l2',
        traceId,
      }),
      createMastraSpan({
        id: 'l4',
        name: 'level4',
        type: SpanType.GENERIC,
        isRoot: false,
        parentSpanId: 'l3',
        traceId,
      }),
    ];

    for (const span of spans) {
      await exporter.exportTracingEvent({
        type: TracingEventType.SPAN_STARTED,
        exportedSpan: span,
      });
    }

    // getSpan() returns BraintrustSpanData, access .span for the underlying Braintrust Span
    const traceData = exporter._getTraceData(traceId);
    const l1 = getSpanInternals(traceData.getSpan({ spanId: 'l1' })!.span);
    const l2 = getSpanInternals(traceData.getSpan({ spanId: 'l2' })!.span);
    const l3 = getSpanInternals(traceData.getSpan({ spanId: 'l3' })!.span);
    const l4 = getSpanInternals(traceData.getSpan({ spanId: 'l4' })!.span);

    // All share rootSpanId
    expect(l1.rootSpanId).toBe(l1.spanId);
    expect(l2.rootSpanId).toBe(l1.spanId);
    expect(l3.rootSpanId).toBe(l1.spanId);
    expect(l4.rootSpanId).toBe(l1.spanId);

    // Correct parent chain
    expect(l1.spanParents).toBeUndefined();
    expect(l2.spanParents).toEqual([l1.spanId]);
    expect(l3.spanParents).toEqual([l2.spanId]);
    expect(l4.spanParents).toEqual([l3.spanId]);
  });
});

// =============================================================================
// Exporter Tests - External Case
// =============================================================================

describe('BraintrustExporter - External Case', () => {
  let logger: Logger<true>;

  beforeAll(async () => {
    logger = await initLogger({
      projectName: 'test-external-integration',
      apiKey: 'test-key',
    });
  });

  it('spans attached to external span have external as true root', async () => {
    // Simulate external span (from Eval or logger.traced())
    const externalSpan = logger.startSpan({ name: 'external-eval', type: 'task' });
    const externalInternals = getSpanInternals(externalSpan);

    // Create exporter that will attach to the external span
    // We need to mock currentSpan() to return our external span
    // For this test, we'll use braintrustLogger with the external span directly
    const exporter = new TestBraintrustExporter({
      braintrustLogger: externalSpan as any, // Treat external span as the "logger"
    });

    // Create Mastra spans
    const mastraRoot = createMastraSpan({
      id: 'mastra-root',
      name: 'mastra-agent',
      type: SpanType.AGENT_RUN,
      isRoot: true,
    });

    const mastraChild = createMastraSpan({
      id: 'mastra-child',
      name: 'mastra-llm',
      type: SpanType.MODEL_GENERATION,
      isRoot: false,
      parentSpanId: 'mastra-root',
      traceId: mastraRoot.traceId,
    });

    // Process through exporter
    await exporter.exportTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: mastraRoot,
    });
    await exporter.exportTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: mastraChild,
    });

    // Get Braintrust spans
    // getSpan() returns BraintrustSpanData, access .span for the underlying Braintrust Span
    const traceData = exporter._getTraceData(mastraRoot.traceId);
    const rootBtData = traceData.getSpan({ spanId: 'mastra-root' });
    const childBtData = traceData.getSpan({ spanId: 'mastra-child' });

    const root = getSpanInternals(rootBtData!.span);
    const child = getSpanInternals(childBtData!.span);

    // Both should have external span as their root
    expect(root.rootSpanId).toBe(externalInternals.spanId);
    expect(child.rootSpanId).toBe(externalInternals.spanId);

    // Mastra root's parent should be external span
    expect(root.spanParents).toEqual([externalInternals.spanId]);
    // Mastra child's parent should be mastra root
    expect(child.spanParents).toEqual([root.spanId]);

    // Cleanup
    childBtData!.span.end();
    rootBtData!.span.end();
    externalSpan.end();
  });
});
