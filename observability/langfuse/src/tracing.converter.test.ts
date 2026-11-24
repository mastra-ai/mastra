import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { LangfuseExporter } from './tracing';

// Unlike tracing.test.ts, this file runs the real @mastra/otel-exporter
// SpanConverter so the promotion of mastra.<span_type>.* attributes to
// langfuse.observation.metadata.* is checked against the actual key names.
const processedSpans: any[] = [];

vi.mock('@langfuse/otel', () => {
  class MockLangfuseSpanProcessor {
    onStart = vi.fn();
    onEnd = vi.fn().mockImplementation((span: any) => {
      processedSpans.push(span);
    });
    forceFlush = vi.fn().mockResolvedValue(undefined);
    shutdown = vi.fn().mockResolvedValue(undefined);
  }
  return { LangfuseSpanProcessor: MockLangfuseSpanProcessor };
});

vi.mock('@langfuse/client', () => {
  class MockLangfuseClient {
    score = { create: vi.fn() };
    prompt = {};
    flush = vi.fn().mockResolvedValue(undefined);
    shutdown = vi.fn().mockResolvedValue(undefined);
  }
  return { LangfuseClient: MockLangfuseClient };
});

const METADATA_PREFIX = 'langfuse.observation.metadata.';

function makeSpan(type: SpanType, attributes: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    id: `span-${type}`,
    traceId: 'trace-1',
    type,
    name: `${type} span`,
    startTime: new Date('2025-01-01T00:00:00Z'),
    endTime: new Date('2025-01-01T00:00:01Z'),
    input: { value: 'in' },
    output: { value: 'out' },
    attributes,
    ...extra,
  } as unknown as AnyExportedSpan;
}

const spans: AnyExportedSpan[] = [
  makeSpan(SpanType.MODEL_STEP, { stepIndex: 1, isContinued: false }),
  makeSpan(SpanType.RAG_EMBEDDING, { model: 'text-embedding-3-small', mode: 'batch', dimensions: 1536, inputCount: 3 }),
  makeSpan(SpanType.MCP_TOOL_CALL, { toolId: 'tool', mcpServer: 'server', serverVersion: '1.0.0' }),
  makeSpan(SpanType.MCP_SERVER_REQUEST, {
    mcpMethod: 'tools/call',
    mcpServer: 'server',
    targetName: 'tool',
    clientName: 'client',
    clientVersion: '2.0.0',
  }),
  makeSpan(SpanType.WORKFLOW_RUN, { status: 'success' }),
  makeSpan(
    SpanType.WORKFLOW_STEP,
    { status: 'success', entryId: 'step-1', entryDescription: 'first step', entryMetadata: { owner: 'team-a' } },
    { entityId: 'step-1' },
  ),
  makeSpan(SpanType.WORKFLOW_CONDITIONAL, {
    conditionCount: 2,
    truthyIndexes: [0, 1],
    selectedSteps: ['a', 'b'],
    entryMetadata: { nested: { deep: true } },
  }),
  makeSpan(SpanType.WORKFLOW_CONDITIONAL_EVAL, { conditionIndex: 0, result: true }),
  makeSpan(SpanType.WORKFLOW_PARALLEL, { branchCount: 2, parallelSteps: ['a', 'b'] }),
  makeSpan(SpanType.WORKFLOW_LOOP, { loopType: 'foreach', iteration: 1, totalIterations: 3, concurrency: 2 }),
  makeSpan(SpanType.WORKFLOW_SLEEP, {
    durationMs: 10,
    untilDate: new Date('2025-01-02T00:00:00Z'),
    sleepType: 'until',
  }),
  makeSpan(SpanType.WORKFLOW_WAIT_EVENT, { eventName: 'ping', timeoutMs: 100, eventReceived: true, waitDurationMs: 5 }),
];

describe('LangfuseExporter with the real SpanConverter', () => {
  let exporter: LangfuseExporter | undefined;

  afterEach(async () => {
    await exporter?.shutdown();
    exporter = undefined;
    processedSpans.length = 0;
  });

  it('promotes scalar span attributes and never object or array values', async () => {
    exporter = new LangfuseExporter({ publicKey: 'pk-test', secretKey: 'sk-test' });
    for (const span of spans) {
      await exporter.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: span });
    }
    expect(processedSpans).toHaveLength(spans.length);

    const promoted: Record<string, Record<string, unknown>> = {};
    for (const otelSpan of processedSpans) {
      const type = otelSpan.attributes['mastra.span.type'];
      promoted[type] = Object.fromEntries(
        Object.entries(otelSpan.attributes)
          .filter(([key]) => key.startsWith(METADATA_PREFIX))
          .map(([key, value]) => [key.slice(METADATA_PREFIX.length), value]),
      );
      for (const [key, value] of Object.entries(promoted[type])) {
        expect(typeof value, `${type}.${key}`).toBe('string');
        expect(String(value), `${type}.${key}`).not.toMatch(/^[[{]/);
      }
      expect(promoted[type].input).toBeUndefined();
      expect(promoted[type].output).toBeUndefined();
    }

    expect(promoted.model_step).toMatchObject({ stepIndex: '1', isContinued: 'false' });
    expect(promoted.rag_embedding).toMatchObject({ mode: 'batch', dimensions: '1536', inputCount: '3' });
    expect(promoted.mcp_tool_call).toMatchObject({ serverName: 'server', serverVersion: '1.0.0' });
    expect(promoted.mcp_server_request).toMatchObject({
      serverName: 'server',
      targetName: 'tool',
      clientName: 'client',
      clientVersion: '2.0.0',
    });
    expect(promoted.workflow_run).toMatchObject({ status: 'success' });
    expect(promoted.workflow_step).toMatchObject({
      stepId: 'step-1',
      status: 'success',
      entryId: 'step-1',
      entryDescription: 'first step',
    });
    expect(promoted.workflow_step.entryMetadata).toBeUndefined();
    expect(promoted.workflow_conditional).toMatchObject({ conditionCount: '2' });
    expect(promoted.workflow_conditional.truthyIndexes).toBeUndefined();
    expect(promoted.workflow_conditional.selectedSteps).toBeUndefined();
    expect(promoted.workflow_conditional.entryMetadata).toBeUndefined();
    expect(promoted.workflow_conditional_eval).toMatchObject({ conditionIndex: '0', result: 'true' });
    expect(promoted.workflow_parallel).toMatchObject({ branchCount: '2' });
    expect(promoted.workflow_parallel.parallelSteps).toBeUndefined();
    expect(promoted.workflow_loop).toMatchObject({
      loopType: 'foreach',
      iteration: '1',
      totalIterations: '3',
      concurrency: '2',
    });
    expect(promoted.workflow_sleep).toMatchObject({
      durationMs: '10',
      untilDate: '2025-01-02T00:00:00.000Z',
      sleepType: 'until',
    });
    expect(promoted.workflow_wait_event).toMatchObject({
      eventName: 'ping',
      timeoutMs: '100',
      eventReceived: 'true',
      waitDurationMs: '5',
    });
  });
});
