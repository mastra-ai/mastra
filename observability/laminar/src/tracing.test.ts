import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import { LaminarExporter, otelSpanIdToUUID, otelTraceIdToUUID } from './tracing';

// Mock OTLP exporter so tests never hit the network.
vi.mock('@opentelemetry/exporter-trace-otlp-proto', () => ({
  OTLPTraceExporter: vi.fn().mockImplementation(function () {
    return {
      export: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
  }),
}));

vi.mock('@opentelemetry/sdk-trace-base', () => ({
  SimpleSpanProcessor: vi.fn().mockImplementation(function () {
    return {
      onEnd: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
      forceFlush: vi.fn().mockResolvedValue(undefined),
    };
  }),
  BatchSpanProcessor: vi.fn().mockImplementation(function () {
    return {
      onEnd: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
      forceFlush: vi.fn().mockResolvedValue(undefined),
    };
  }),
}));

describe('LaminarExporter', () => {
  let exporter: LaminarExporter;

  beforeEach(() => {
    exporter = new LaminarExporter({ apiKey: 'test-api-key' });
  });

  afterEach(async () => {
    await exporter.shutdown();
    vi.restoreAllMocks();
  });

  it('computes lmnr.span.path and lmnr.span.ids_path for nested spans', async () => {
    const rootSpan = {
      id: '0000000000000001',
      traceId: '00000000000000000000000000000001',
      parentSpanId: undefined,
      type: SpanType.AGENT_RUN,
      name: 'root',
      startTime: new Date(),
      endTime: new Date(),
      isEvent: false,
      isRootSpan: true,
      tags: ['a', 'b'],
      metadata: { sessionId: 's1', userId: 'u1' },
    } as unknown as AnyExportedSpan;

    const child = {
      id: '0000000000000002',
      traceId: rootSpan.traceId,
      parentSpanId: rootSpan.id,
      type: SpanType.MODEL_GENERATION,
      name: 'gen',
      startTime: new Date(),
      endTime: new Date(),
      isEvent: false,
      isRootSpan: false,
      input: [{ role: 'user', content: 'hi' }],
      output: { text: 'hello' },
      attributes: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        usage: { inputTokens: 3, outputTokens: 5, inputDetails: { cacheRead: 1, cacheWrite: 2 } },
      },
      metadata: { sessionId: 's1', userId: 'u1' },
    } as unknown as AnyExportedSpan;

    await exporter.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: rootSpan });
    await exporter.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: child });

    await exporter.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: child });
    await exporter.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: rootSpan });

    const processor = (exporter as any).processor;
    expect(processor).toBeDefined();
    expect(processor.onEnd).toHaveBeenCalled();

    const exportedChild = processor.onEnd.mock.calls[0][0];
    expect(exportedChild.attributes['lmnr.span.path']).toEqual(['root', 'gen']);
    expect(exportedChild.attributes['lmnr.span.ids_path']).toEqual([
      otelSpanIdToUUID(rootSpan.id),
      otelSpanIdToUUID(child.id),
    ]);

    expect(exportedChild.attributes['lmnr.span.type']).toBe('LLM');
    expect(exportedChild.attributes['lmnr.span.input']).toBe(JSON.stringify(child.input));
    expect(exportedChild.attributes['lmnr.span.output']).toBe(JSON.stringify(child.output));

    expect(exportedChild.attributes['gen_ai.system']).toBe('openai');
    expect(exportedChild.attributes['gen_ai.request.model']).toBe('gpt-4o-mini');
    expect(exportedChild.attributes['gen_ai.usage.input_tokens']).toBe(3);
    expect(exportedChild.attributes['gen_ai.usage.output_tokens']).toBe(5);
    expect(exportedChild.attributes['gen_ai.usage.cache_read_input_tokens']).toBe(1);
    expect(exportedChild.attributes['gen_ai.usage.cache_creation_input_tokens']).toBe(2);
  });

  it('converts OTEL IDs to UUIDs for evaluator score API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, statusText: 'OK' });
    vi.stubGlobal('fetch', fetchMock as any);

    await exporter.addScoreToTrace({
      traceId: '00000000000000000000000000000001',
      score: 0.9,
      scorerName: 'quality',
    });

    expect(fetchMock).toHaveBeenCalled();
    const [url, req] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/v1/evaluators/score');
    const body = JSON.parse((req as any).body);
    expect(body.traceId).toBe(otelTraceIdToUUID('00000000000000000000000000000001'));

    await exporter.addScoreToTrace({
      traceId: '00000000000000000000000000000001',
      spanId: '0000000000000002',
      score: 0.1,
      scorerName: 'toxicity',
    });

    const body2 = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body2.spanId).toBe(otelSpanIdToUUID('0000000000000002'));
  });
});

