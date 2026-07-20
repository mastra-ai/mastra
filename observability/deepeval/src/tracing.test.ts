import { SpanType, TracingEventType } from '@mastra/core/observability';
import type { AnyExportedSpan, TracingEvent } from '@mastra/core/observability';
import { BaseExporter } from '@mastra/observability';
import { describe, expect, it, vi } from 'vitest';

import { DeepEvalExporter } from './tracing';
import type { DeepEvalExporterConfig } from './tracing';

type CapturedTrace = Parameters<NonNullable<DeepEvalExporterConfig['traceCaptureSink']>>[0];

type SpanInput = Partial<AnyExportedSpan> & {
  id: string;
  type: AnyExportedSpan['type'];
};

function span(input: SpanInput): AnyExportedSpan {
  return {
    traceId: 't1',
    name: input.id,
    startTime: new Date('2024-01-01T00:00:00Z'),
    isEvent: false,
    isRootSpan: false,
    ...input,
  } as AnyExportedSpan;
}

const started = (exportedSpan: AnyExportedSpan): TracingEvent => ({
  type: TracingEventType.SPAN_STARTED,
  exportedSpan,
});
const ended = (exportedSpan: AnyExportedSpan): TracingEvent => ({
  type: TracingEventType.SPAN_ENDED,
  exportedSpan,
});

async function run(config: DeepEvalExporterConfig, events: TracingEvent[]): Promise<CapturedTrace[]> {
  const captured: CapturedTrace[] = [];
  const exporter = new DeepEvalExporter({
    apiKey: 'test-key',
    traceCaptureSink: trace => captured.push(trace),
    ...config,
  });
  for (const event of events) {
    await exporter.exportTracingEvent(event);
  }
  return captured;
}

describe('DeepEvalExporter', () => {
  it('is a BaseExporter named "deepeval"', () => {
    const exporter = new DeepEvalExporter({ apiKey: 'test-key' });
    expect(exporter).toBeInstanceOf(BaseExporter);
    expect(exporter.name).toBe('deepeval');
  });

  it('builds an agent trace with a nested LLM span', async () => {
    const agent = span({
      id: 'a',
      type: SpanType.AGENT_RUN,
      name: "agent run: 'weather'",
      entityName: 'Weather Agent',
      isRootSpan: true,
      input: { question: 'weather in Tokyo?' },
    });
    const model = span({
      id: 'm',
      parentSpanId: 'a',
      type: SpanType.MODEL_GENERATION,
      name: "llm: 'gpt-4o-mini'",
      attributes: { model: 'gpt-4o-mini', usage: { inputTokens: 10, outputTokens: 5 } },
    });

    const traces = await run({}, [
      started(agent),
      started(model),
      ended({ ...model, endTime: new Date(), output: 'Sunny.' }),
      ended({ ...agent, endTime: new Date(), output: 'Sunny.' }),
    ]);

    expect(traces).toHaveLength(1);
    const root = traces[0].rootSpans[0];
    expect(root.type).toBe('agent');
    expect(root.children).toHaveLength(1);
    expect(root.children[0]).toMatchObject({
      type: 'llm',
      model: 'gpt-4o-mini',
      inputTokenCount: 10,
      outputTokenCount: 5,
    });
    expect(traces[0].input).toEqual({ question: 'weather in Tokyo?' });
    expect(traces[0].output).toBe('Sunny.');
  });

  it('records tool calls on the trace', async () => {
    const agent = span({ id: 'a', type: SpanType.AGENT_RUN, isRootSpan: true });
    const tool = span({
      id: 'tl',
      parentSpanId: 'a',
      type: SpanType.TOOL_CALL,
      name: "tool: 'get_weather'",
      entityName: 'get_weather',
      input: { city: 'Tokyo' },
    });

    const traces = await run({}, [
      started(agent),
      started(tool),
      ended({ ...tool, endTime: new Date(), output: { weather: 'Sunny' } }),
      ended({ ...agent, endTime: new Date() }),
    ]);

    expect(traces[0].rootSpans[0].children[0]).toMatchObject({ type: 'tool', name: 'get_weather' });
    expect(traces[0].toolsCalled).toHaveLength(1);
    expect(traces[0].toolsCalled?.[0]).toMatchObject({
      name: 'get_weather',
      inputParameters: { city: 'Tokyo' },
    });
  });

  it('applies per-request tracing context over exporter defaults', async () => {
    const agent = span({
      id: 'a',
      type: SpanType.AGENT_RUN,
      isRootSpan: true,
      metadata: {
        threadId: 'thread-123',
        userId: 'user-xyz',
        testCaseId: 'tc-1',
        turnId: 'turn-1',
        team: 'growth',
      },
      tags: ['req-tag'],
    });

    const traces = await run(
      { threadId: 'config-thread', userId: 'config-user', tags: ['config-tag'] },
      [started(agent), ended({ ...agent, endTime: new Date() })],
    );

    const trace = traces[0];
    expect(trace.threadId).toBe('thread-123');
    expect(trace.userId).toBe('user-xyz');
    expect(trace.tags).toEqual(['req-tag']);
    expect(trace.testCaseId).toBe('tc-1');
    expect(trace.turnId).toBe('turn-1');
    expect(trace.metadata?.team).toBe('growth');
  });

  it('drops streaming event spans', async () => {
    const agent = span({ id: 'a', type: SpanType.AGENT_RUN, isRootSpan: true });
    const chunk = span({ id: 'c', parentSpanId: 'a', type: SpanType.MODEL_CHUNK, name: "chunk: 'text'" });

    const traces = await run({}, [
      started(agent),
      started(chunk),
      ended({ ...chunk, endTime: new Date() }),
      ended({ ...agent, endTime: new Date() }),
    ]);

    expect(traces[0].rootSpans[0].children).toHaveLength(0);
  });

  it('applies the customSpanFormatter before exporting', async () => {
    const traces = await run(
      { customSpanFormatter: (exportedSpan: AnyExportedSpan) => ({ ...exportedSpan, name: 'FORMATTED' }) },
      [
        started(span({ id: 'a', type: SpanType.AGENT_RUN, isRootSpan: true })),
        ended(span({ id: 'a', type: SpanType.AGENT_RUN, isRootSpan: true, endTime: new Date() })),
      ],
    );

    expect(traces[0].rootSpans[0].name).toBe('FORMATTED');
  });

  it('is disabled and inert when no API key is available', async () => {
    const previous = process.env.CONFIDENT_API_KEY;
    delete process.env.CONFIDENT_API_KEY;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const captured: CapturedTrace[] = [];
      const exporter = new DeepEvalExporter({ traceCaptureSink: trace => captured.push(trace) });
      const agent = span({ id: 'a', type: SpanType.AGENT_RUN, isRootSpan: true });
      await exporter.exportTracingEvent(started(agent));
      await exporter.exportTracingEvent(ended({ ...agent, endTime: new Date() }));

      expect(captured).toHaveLength(0);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      if (previous !== undefined) process.env.CONFIDENT_API_KEY = previous;
    }
  });
});
