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
 * 1. Root spans get the Mastra trace ID as _rootSpanId (pinned via parentSpanIds)
 * 2. Child spans inherit _rootSpanId and get _spanParents via startSpan() chain
 * 3. A resumed root links to its persisted parent span in the same trace
 * 4. External context spans properly nest under external parent
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

// A W3C-shaped Mastra trace ID (32 hex chars), as produced in real runs
const MASTRA_TRACE_ID = '0f1e2d3c4b5a69788796a5b4c3d2e1f0';

// Helper to create mock Mastra spans for testing
function createMastraSpan(options: {
  id: string;
  name: string;
  type: SpanType;
  isRoot: boolean;
  parentSpanId?: string;
  traceId?: string;
  metadata?: Record<string, any>;
  attributes?: Record<string, any>;
}): AnyExportedSpan {
  const traceId = options.traceId ?? MASTRA_TRACE_ID;
  return {
    id: options.id,
    name: options.name,
    type: options.type,
    attributes: options.attributes ?? {},
    metadata: options.metadata ?? {},
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

  it('logger.startSpan() without parentSpanIds creates a W3C rootSpanId', () => {
    const rootSpan = logger.startSpan({ name: 'root', type: 'task' });
    const root = getSpanInternals(rootSpan);

    expect(root.rootSpanId).toMatch(/^[0-9a-f]{32}$/);
    expect(root.rootSpanId).not.toBe(root.spanId);
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

    // All share the same W3C trace ID as rootSpanId
    expect(root.rootSpanId).toMatch(/^[0-9a-f]{32}$/);
    expect(child.rootSpanId).toBe(root.rootSpanId);
    expect(grandchild.rootSpanId).toBe(root.rootSpanId);

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

  it('root span processed by exporter has the Mastra trace ID as rootSpanId', async () => {
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

    // rootSpanId is pinned to the Mastra trace ID so every root sharing a
    // trace (e.g. a resumed workflow run) lands in the same Braintrust trace
    expect(internals.rootSpanId).toBe(MASTRA_TRACE_ID);
    expect(internals.rootSpanId).not.toBe(internals.spanId);
    expect(internals.spanParents).toEqual([]);
  });

  it('resumed root span links to its persisted parent in the same trace', async () => {
    // Simulates a workflow resumed after suspend: core restores the persisted
    // trace ID and parent span ID, and marks the span with resumedFromSpanId
    const resumedRoot = createMastraSpan({
      id: 'resumed-root',
      name: 'workflow-run-resumed',
      type: SpanType.WORKFLOW_RUN,
      isRoot: true,
      parentSpanId: 'suspended-root',
      metadata: { resumed: true, resumedFromSpanId: 'suspended-root' },
    });

    await exporter.exportTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: resumedRoot,
    });

    const traceData = exporter._getTraceData(resumedRoot.traceId);
    const internals = getSpanInternals(traceData.getSpan({ spanId: resumedRoot.id })!.span);

    // Same Braintrust trace as the suspended half, parented under it
    expect(internals.rootSpanId).toBe(MASTRA_TRACE_ID);
    expect(internals.spanParents).toEqual(['suspended-root']);
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

    // All should share the Mastra trace ID as rootSpanId
    expect(root.rootSpanId).toBe(mastraRoot.traceId);
    expect(llm.rootSpanId).toBe(root.rootSpanId);
    expect(tool.rootSpanId).toBe(root.rootSpanId);

    // Each should have correct immediate parent
    expect(root.spanParents).toEqual([]);
    expect(llm.spanParents).toEqual([root.spanId]);
    expect(tool.spanParents).toEqual([llm.spanId]);
  });

  it('deeply nested spans (4 levels) have correct parent chain', async () => {
    const traceId = 'dee9deadbeefdeadbeefdeadbeefc0de';

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

    // All share the Mastra trace ID as rootSpanId
    expect(l1.rootSpanId).toBe(traceId);
    expect(l2.rootSpanId).toBe(l1.rootSpanId);
    expect(l3.rootSpanId).toBe(l1.rootSpanId);
    expect(l4.rootSpanId).toBe(l1.rootSpanId);

    // Correct parent chain
    expect(l1.spanParents).toEqual([]);
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

    // Both should inherit the external span's W3C trace ID
    expect(root.rootSpanId).toBe(externalInternals.rootSpanId);
    expect(child.rootSpanId).toBe(externalInternals.rootSpanId);

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
