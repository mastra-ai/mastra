import { describe, expect, it } from 'vitest';
import { TracingEventType } from '../observability';
import type { PulseRecord, PulseRelationshipRecord } from '../storage/domains/pulse';
import { PulseBridge, spanPulseId } from './bridge';
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

function harness(config: Partial<ConstructorParameters<typeof PulseBridge>[0]> = {}) {
  const bus = new PulseBus();
  const pulses: PulseRecord[] = [];
  const relationships: PulseRelationshipRecord[] = [];
  bus.subscribe((event: PulseBusEvent) => {
    if (event.type === 'pulse') pulses.push(event.record);
    else relationships.push(event.record);
  });
  const bridge = new PulseBridge({ bus, ...config });
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
    expect(pulses[0]!.metadata).toEqual({}); // ids live in columns only — no metadata duplication
    expect(pulses[1]).toMatchObject({ type: 'output', action: 'run_completed' });
    expect(pulses[1]!.data).toEqual({ 'usage.totalTokens': 42 });
    expect(pulses[1]!.attributes).toMatchObject({ output: { a: 'yo' } });
    expect(pulses[1]!.timestamp).toEqual(span.endTime);

    // One id-space: edges reference PULSE RECORD ids, never span ids.
    expect(relationships).toContainEqual(
      expect.objectContaining({
        type: 'origin_of',
        from: { kind: 'pulse', id: pulses[0]!.id },
        to: { kind: 'flow', id: 'trace-1' },
      }),
    );
    // Every trace-bearing pulse gets a flow_contains membership edge.
    for (const p of pulses) {
      expect(relationships).toContainEqual(
        expect.objectContaining({
          type: 'flow_contains',
          from: { kind: 'flow', id: 'trace-1' },
          to: { kind: 'pulse', id: p.id },
        }),
      );
    }
  });

  it('maps errors, event spans, and parent relationships', async () => {
    const { bridge, pulses, relationships } = harness();
    await bridge.exportTracingEvent({
      type: TracingEventType.SPAN_ENDED,
      exportedSpan: makeSpan({ errorInfo: { message: 'boom' }, parentSpanId: 'parent-1' }) as any,
    });
    expect(pulses[0]).toMatchObject({ type: 'error', action: 'run_failed', level: 'error' });
    // Structure edges are emitted at span START — an end-only event carries
    // no parent_of (the started pulse already introduced the node).
    expect(relationships.filter(r => r.type === 'parent_of')).toHaveLength(0);

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
    // Deterministic ids: even a previous process's pulse is addressable by
    // computing its id — no lookups, no fallbacks.
    expect(relationships).toContainEqual(
      expect.objectContaining({
        type: 'resume_of',
        from: { kind: 'pulse', id: spanPulseId('trace-1', 'resumed-root', 'started') },
        to: { kind: 'pulse', id: spanPulseId('trace-1', 'suspended-span', 'started') },
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

describe('PulseBridge nativeSurfaces switch', () => {
  it('skips span translation for native-covered surfaces, keeps the rest', async () => {
    const bus = new PulseBus();
    const pulses: PulseRecord[] = [];
    bus.subscribe((e: PulseBusEvent) => {
      if (e.type === 'pulse') pulses.push(e.record);
    });
    const bridge = new PulseBridge({ bus, nativeSurfaces: ['agent', 'model'] });

    await bridge.exportTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: makeSpan({ id: 's1', type: 'agent_run' }) as any,
    });
    await bridge.exportTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: makeSpan({ id: 's2', type: 'workflow_run' }) as any,
    });
    expect(pulses.map(p => p.surface)).toEqual(['workflow']);

    // Metric fold still works: leftovers drain even when spans are skipped.
    bridge.onMetricEvent(
      tokenMetric('mastra_model_total_output_tokens', 9, {
        spanId: 'skipped-model-span',
        costContext: { estimatedCost: 0.002 },
      }) as any,
    );
    await bridge.flush();
    const leftover = pulses.find(p => p.action === 'metric_recorded');
    expect(leftover?.data).toEqual({ total_output_tokens: 9 });
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

  it('caps payloads by UTF-8 bytes, never splitting a code point', async () => {
    const { bridge, pulses } = harness({ payloadCapBytes: 16 });
    await bridge.exportTracingEvent({
      type: TracingEventType.SPAN_ENDED,
      exportedSpan: makeSpan({
        id: 'model-span-1',
        type: 'model_generation',
        // 10 × '€' = 10 chars but 30 UTF-8 bytes — over a 16-byte cap even
        // though the old char-count check would have passed it.
        output: { text: '€€€€€€€€€€' },
        attributes: { model: 'gpt-5', provider: 'openai' },
      }) as any,
    });
    expect(pulses).toHaveLength(1);
    const output = (pulses[0]!.attributes as any).output;
    expect(output.truncated).toBe(true);
    // Byte-truncated preview is valid UTF-8 (no lone surrogate/replacement).
    expect(Buffer.byteLength(output.preview, 'utf8')).toBeLessThanOrEqual(16);
    expect(output.preview.includes('\uFFFD')).toBe(false);
  });

  it('folds cost from carrier totals only — detail costs are constituents, not additions', async () => {
    const { bridge, pulses } = harness();

    // Real estimator shape (metrics/estimator.ts): each detail metric carries
    // its own estimatedCost AND the total metric carries the SUM of those
    // details. Folding all of them doubles the true cost.
    bridge.onMetricEvent(
      tokenMetric('mastra_model_input_text_tokens', 30, { costContext: { estimatedCost: 0.003 } }) as any,
    );
    bridge.onMetricEvent(
      tokenMetric('mastra_model_total_input_tokens', 30, { costContext: { estimatedCost: 0.003 } }) as any,
    );
    bridge.onMetricEvent(
      tokenMetric('mastra_model_output_text_tokens', 30, { costContext: { estimatedCost: 0.005 } }) as any,
    );
    bridge.onMetricEvent(
      tokenMetric('mastra_model_output_reasoning_tokens', 10, { costContext: { estimatedCost: 0.002 } }) as any,
    );
    bridge.onMetricEvent(
      tokenMetric('mastra_model_total_output_tokens', 40, { costContext: { estimatedCost: 0.007 } }) as any,
    );

    await bridge.exportTracingEvent({
      type: TracingEventType.SPAN_ENDED,
      exportedSpan: makeSpan({
        id: 'model-span-1',
        type: 'model_generation',
        output: { text: 'hi' },
        attributes: { model: 'gpt-5', provider: 'openai', usage: { totalTokens: 70 } },
      }) as any,
    });

    expect(pulses).toHaveLength(1);
    // Cost never folds at write anymore — it is DERIVED at read time from
    // usage × the pulse price table. The fold carries tokens only.
    expect(pulses[0]!.data!.cost_usd).toBeUndefined();
    expect(pulses[0]!.data).toMatchObject({ total_input_tokens: 30, total_output_tokens: 40 });
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
    expect(pulses[0]!.data).toEqual({ total_input_tokens: 30, total_output_tokens: 40 });

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
    expect(relationships.find(r => r.type === 'scored_target')).toMatchObject({
      from: { kind: 'pulse', id: pulses[0]!.id },
      to: { kind: 'pulse', id: spanPulseId('trace-1', 'span-9', 'started') },
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
    expect(relationships.find(r => r.type === 'scored_target')).toMatchObject({
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

describe('PulseBridge flush chain (durable/serverless drain)', () => {
  /**
   * observability.flush() drains the o11y bus, which calls bridge.flush().
   * That must transitively drain the PULSE bus writers too — otherwise a
   * durable engine's flush returns while pulse rows still sit in exporter
   * buffers, and a process freeze loses them.
   */
  it('flush() drains the pulse bus exporter buffers', async () => {
    const bus = new PulseBus();
    const written: PulseBusEvent[] = [];
    let buffer: PulseBusEvent[] = [];
    bus.registerExporter({
      name: 'buffering',
      onPulseEvent: e => {
        buffer.push(e);
      },
      flush: async () => {
        written.push(...buffer);
        buffer = [];
      },
      shutdown: async () => {},
    });
    const bridge = new PulseBridge({ bus });

    await bridge.exportTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: makeSpan(),
    } as any);
    expect(written).toHaveLength(0); // still buffered

    await bridge.flush();
    expect(written.length).toBeGreaterThan(0); // drained by the bridge's flush
  });
});
