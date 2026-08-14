import { describe, expect, it } from 'vitest';
import { TracingEventType } from '../observability';
import type { PulseRecord, PulseRelationshipRecord } from '../storage/domains/pulse';
import { PulseBridge } from './bridge';
import { PulseBus } from './bus';
import type { PulseBusEvent } from './types';

function makeSpan(overrides: Record<string, any> = {}) {
  return {
    id: 'span-1',
    name: 'test-agent',
    type: 'agent_run',
    traceId: 'trace-1',
    startTime: new Date('2026-08-14T10:00:00.000Z'),
    endTime: new Date('2026-08-14T10:00:01.500Z'),
    isRootSpan: false,
    isEvent: false,
    metadata: { runId: 'run-1', threadId: 'thread-1', resourceId: 'res-1' },
    attributes: {},
    ...overrides,
  };
}

function harness() {
  const bus = new PulseBus();
  const pulses: PulseRecord[] = [];
  const relationships: PulseRelationshipRecord[] = [];
  bus.subscribe((event: PulseBusEvent) => {
    if (event.type === 'pulse') pulses.push(event.record);
    else relationships.push(event.record);
  });
  const bridge = new PulseBridge({ bus });
  return { bus, bridge, pulses, relationships };
}

function tokenMetric(name: string, value: number, overrides: Record<string, any> = {}) {
  return {
    type: 'metric' as const,
    metric: {
      metricId: `m-${name}`,
      timestamp: new Date(),
      traceId: 'trace-1',
      spanId: 'model-span-1',
      name,
      value,
      labels: {},
      ...overrides,
    },
  };
}

describe('PulseBridge span translation', () => {
  it('translates agent span start/end with identity, metadata, and usage data', async () => {
    const { bridge, pulses, relationships } = harness();
    const span = makeSpan({
      isRootSpan: true,
      input: { q: 'hi' },
      output: { a: 'yo' },
      attributes: { usage: { totalTokens: 42 } },
    });
    await bridge.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: span as any });
    await bridge.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: span as any });

    expect(pulses).toHaveLength(2);
    expect(pulses[0]).toMatchObject({
      type: 'state',
      surface: 'agent',
      action: 'run_started',
      runId: 'run-1',
      threadId: 'thread-1',
      resourceId: 'res-1',
      traceId: 'trace-1',
      spanId: 'span-1',
      source: 'span',
    });
    expect(pulses[0]!.attributes).toMatchObject({ input: { q: 'hi' } });
    expect(pulses[0]!.metadata).toEqual({ runId: 'run-1', threadId: 'thread-1', resourceId: 'res-1' });
    expect(pulses[1]).toMatchObject({ type: 'output', action: 'run_completed' });
    expect(pulses[1]!.data).toEqual({ 'usage.totalTokens': 42 });
    expect(pulses[1]!.attributes).toMatchObject({ output: { a: 'yo' } });
    expect(pulses[1]!.timestamp).toEqual(span.endTime);

    expect(relationships).toContainEqual(
      expect.objectContaining({
        type: 'origin_of',
        from: { kind: 'pulse', id: 'span-1' },
        to: { kind: 'flow', id: 'trace-1' },
      }),
    );
  });

  it('maps errors, event spans, and parent relationships', async () => {
    const { bridge, pulses, relationships } = harness();
    await bridge.exportTracingEvent({
      type: TracingEventType.SPAN_ENDED,
      exportedSpan: makeSpan({ errorInfo: { message: 'boom' }, parentSpanId: 'parent-1' }) as any,
    });
    expect(pulses[0]).toMatchObject({ type: 'error', action: 'run_failed', level: 'error' });
    expect(relationships).toContainEqual(
      expect.objectContaining({
        type: 'parent_of',
        from: { kind: 'pulse', id: 'parent-1' },
        to: { kind: 'pulse', id: 'span-1' },
      }),
    );

    await bridge.exportTracingEvent({
      type: TracingEventType.SPAN_ENDED,
      exportedSpan: makeSpan({ id: 'evt-1', type: 'generic', isEvent: true }) as any,
    });
    const eventPulse = pulses.find(p => p.spanId === 'evt-1');
    expect(eventPulse).toMatchObject({ type: 'progress', surface: 'execution', action: 'op' });
  });

  it('emits resume_of for resumed roots', async () => {
    const { bridge, relationships } = harness();
    await bridge.exportTracingEvent({
      type: TracingEventType.SPAN_ENDED,
      exportedSpan: makeSpan({
        id: 'resumed-root',
        isRootSpan: true,
        parentSpanId: 'suspended-span',
        metadata: { runId: 'run-2', resumed: true, resumedFromSpanId: 'suspended-span' },
      }) as any,
    });
    expect(relationships).toContainEqual(
      expect.objectContaining({
        type: 'resume_of',
        from: { kind: 'pulse', id: 'resumed-root' },
        to: { kind: 'pulse', id: 'suspended-span' },
      }),
    );
  });

  it('emits uses_model_settings and uses_tool_definition for model generations', async () => {
    const { bridge, relationships } = harness();
    await bridge.exportTracingEvent({
      type: TracingEventType.SPAN_ENDED,
      exportedSpan: makeSpan({
        id: 'model-span-1',
        type: 'model_generation',
        attributes: { model: 'gpt-5', provider: 'openai', tools: ['issue_refund', { name: 'lookup' }] },
      }) as any,
    });
    expect(relationships).toContainEqual(
      expect.objectContaining({ type: 'uses_model_settings', to: { kind: 'definition', id: 'model:openai/gpt-5' } }),
    );
    expect(relationships).toContainEqual(
      expect.objectContaining({ type: 'uses_tool_definition', to: { kind: 'definition', id: 'tool:issue_refund' } }),
    );
    expect(relationships).toContainEqual(
      expect.objectContaining({ type: 'uses_tool_definition', to: { kind: 'definition', id: 'tool:lookup' } }),
    );
  });

  it('caps oversized payloads', async () => {
    const bus = new PulseBus();
    const pulses: PulseRecord[] = [];
    bus.subscribe(e => {
      if (e.type === 'pulse') pulses.push(e.record);
    });
    const bridge = new PulseBridge({ bus, payloadCapBytes: 32 });
    await bridge.exportTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: makeSpan({ input: { text: 'x'.repeat(200) } }) as any,
    });
    expect(pulses[0]!.attributes!.input).toMatchObject({ truncated: true });
  });

  it('counts skipped SPAN_UPDATED events without emitting records', async () => {
    const { bridge, pulses } = harness();
    const span = makeSpan();
    await bridge.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: span as any });
    await bridge.exportTracingEvent({ type: TracingEventType.SPAN_UPDATED, exportedSpan: span as any });
    await bridge.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: span as any });
    expect(bridge.skippedUpdateCount).toBe(1);
    expect(pulses).toHaveLength(2);
  });

  it('maps unmapped span types onto the execution surface with the raw type as action base', async () => {
    const { bridge, pulses } = harness();
    await bridge.exportTracingEvent({
      type: TracingEventType.SPAN_ENDED,
      exportedSpan: makeSpan({ type: 'somefuture_span_type' }) as any,
    });
    expect(pulses[0]).toMatchObject({ surface: 'execution', action: 'somefuture_span_type_completed' });
  });
});

describe('PulseBridge enrichment switch (directive 3)', () => {
  it('folds token/cost metrics into the model pulse data instead of emitting metric pulses', async () => {
    const { bridge, pulses } = harness();

    // R2 ordering: metrics arrive BEFORE span_ended, same tick.
    bridge.onMetricEvent(
      tokenMetric('mastra_model_total_input_tokens', 30, {
        costContext: { estimatedCost: 0.003 },
      }) as any,
    );
    bridge.onMetricEvent(
      tokenMetric('mastra_model_total_output_tokens', 35, {
        costContext: { estimatedCost: 0.007 },
      }) as any,
    );
    bridge.onMetricEvent(tokenMetric('mastra_model_output_reasoning_tokens', 5) as any);
    expect(pulses).toHaveLength(0); // token metrics never become pulses

    await bridge.exportTracingEvent({
      type: TracingEventType.SPAN_ENDED,
      exportedSpan: makeSpan({
        id: 'model-span-1',
        type: 'model_generation',
        output: { text: 'hi' },
        attributes: { model: 'gpt-5', provider: 'openai', usage: { totalTokens: 65 } },
      }) as any,
    });

    expect(pulses).toHaveLength(1);
    expect(pulses[0]).toMatchObject({ surface: 'model', action: 'generate_completed', type: 'output' });
    expect(pulses[0]!.data).toEqual({
      'usage.totalTokens': 65,
      total_input_tokens: 30,
      total_output_tokens: 35,
      output_reasoning_tokens: 5,
      cost_usd: 0.01,
    });

    // Cache entry consumed: flush emits no leftover metric pulses.
    await bridge.flush();
    expect(pulses).toHaveLength(1);
  });

  it('folds into model_step and model_inference end pulses too', async () => {
    for (const type of ['model_step', 'model_inference']) {
      const { bridge, pulses } = harness();
      bridge.onMetricEvent(tokenMetric('mastra_model_input_text_tokens', 12, { spanId: 's-x' }) as any);
      await bridge.exportTracingEvent({
        type: TracingEventType.SPAN_ENDED,
        exportedSpan: makeSpan({ id: 's-x', type }) as any,
      });
      expect(pulses[0]!.data).toMatchObject({ input_text_tokens: 12 });
    }
  });

  it('drops duration metrics entirely (derivable from pulse pairs)', () => {
    const { bridge, pulses } = harness();
    for (const name of [
      'mastra_agent_duration_ms',
      'mastra_tool_duration_ms',
      'mastra_workflow_duration_ms',
      'mastra_model_duration_ms',
      'mastra_custom_thing_duration_ms',
    ]) {
      bridge.onMetricEvent(tokenMetric(name, 1234) as any);
    }
    expect(pulses).toHaveLength(0);
  });

  it('emits custom metrics as metric_recorded pulses — never the metric name as action', () => {
    const { bridge, pulses } = harness();
    bridge.onMetricEvent(tokenMetric('my_queue_depth', 9, { labels: { queue: 'default' }, spanId: undefined }) as any);
    expect(pulses[0]).toMatchObject({
      action: 'metric_recorded',
      surface: 'execution',
      type: 'state',
      source: 'metric',
    });
    expect(pulses[0]!.data).toEqual({ value: 9 });
    expect(pulses[0]!.attributes).toMatchObject({ name: 'my_queue_depth', queue: 'default' });

    bridge.onMetricEvent(
      tokenMetric('custom_model_latency_score', 0.5, { costContext: { estimatedCost: 0.001 } }) as any,
    );
    expect(pulses[1]).toMatchObject({ action: 'metric_recorded', surface: 'model' });
    expect(pulses[1]!.data).toEqual({ value: 0.5, cost_usd: 0.001 });
  });

  it('falls back to metric_recorded for token metrics without a spanId', () => {
    const { bridge, pulses } = harness();
    bridge.onMetricEvent(tokenMetric('mastra_model_total_input_tokens', 30, { spanId: undefined }) as any);
    expect(pulses).toHaveLength(1);
    expect(pulses[0]).toMatchObject({ action: 'metric_recorded', surface: 'model' });
  });

  it('drains leftover cache entries as metric_recorded pulses on flush and shutdown', async () => {
    const { bridge, pulses } = harness();
    bridge.onMetricEvent(tokenMetric('mastra_model_total_input_tokens', 30, { spanId: 'never-ends' }) as any);
    bridge.onMetricEvent(
      tokenMetric('mastra_model_total_output_tokens', 40, {
        spanId: 'never-ends',
        costContext: { estimatedCost: 0.004 },
      }) as any,
    );
    expect(pulses).toHaveLength(0);

    await bridge.flush();
    expect(pulses).toHaveLength(1);
    expect(pulses[0]).toMatchObject({
      action: 'metric_recorded',
      surface: 'model',
      spanId: 'never-ends',
      traceId: 'trace-1',
      source: 'metric',
    });
    expect(pulses[0]!.data).toEqual({ total_input_tokens: 30, total_output_tokens: 40, cost_usd: 0.004 });

    // Cache cleared: draining again emits nothing.
    await bridge.shutdown();
    expect(pulses).toHaveLength(1);
  });
});

describe('PulseBridge log/score/feedback/drop families', () => {
  it('maps logs to execution.log pulses with level normalization', () => {
    const { bridge, pulses } = harness();
    bridge.onLogEvent({
      type: 'log',
      log: { traceId: 'trace-1', spanId: 'span-1', level: 'fatal', message: 'it broke', data: { code: 500 } },
    } as any);
    expect(pulses[0]).toMatchObject({
      type: 'error',
      surface: 'execution',
      action: 'log',
      level: 'error',
      text: 'it broke',
      source: 'log',
    });
    expect(pulses[0]!.attributes).toEqual({ code: 500 });
  });

  it('maps score events to eval pulses with scored_target edges', () => {
    const { bridge, pulses, relationships } = harness();
    bridge.onScoreEvent({
      type: 'score',
      score: { scoreId: 's1', timestamp: new Date(), traceId: 'trace-1', spanId: 'span-9', scorerId: 'sc', score: 0.9 },
    } as any);
    expect(pulses[0]).toMatchObject({ surface: 'eval', action: 'score_recorded', type: 'output', source: 'score' });
    expect(pulses[0]!.data).toEqual({ score: 0.9 });
    expect(relationships[0]).toMatchObject({
      type: 'scored_target',
      from: { kind: 'pulse', id: pulses[0]!.id },
      to: { kind: 'pulse', id: 'span-9' },
    });
  });

  it('maps feedback events to eval pulses with feedback-kind scored_target edges', () => {
    const { bridge, pulses, relationships } = harness();
    bridge.onFeedbackEvent({
      type: 'feedback',
      feedback: { feedbackId: 'f1', timestamp: new Date(), traceId: 'trace-1', feedbackType: 'thumbs', value: 1 },
    } as any);
    expect(pulses[0]).toMatchObject({
      surface: 'eval',
      action: 'feedback_recorded',
      type: 'input',
      source: 'feedback',
    });
    expect(relationships[0]).toMatchObject({
      type: 'scored_target',
      to: { kind: 'flow', id: 'trace-1' },
      attributes: { kind: 'feedback' },
    });
  });

  it('records observability drop events as system pulses', () => {
    const { bridge, pulses } = harness();
    bridge.onDroppedEvent({
      type: 'drop',
      signal: 'tracing',
      reason: 'buffer-full',
      count: 7,
      timestamp: new Date(),
      exporterName: 'x',
    } as any);
    expect(pulses[0]).toMatchObject({ type: 'system', surface: 'execution', action: 'events_dropped', source: 'drop' });
    expect(pulses[0]!.data).toEqual({ count: 7 });
  });
});
