import { SamplingStrategyType, SpanType, TracingEventType } from '@mastra/core/observability';
import type { MetricEvent, ObservabilityExporter, TracingEvent } from '@mastra/core/observability';
import { describe, expect, it } from 'vitest';
import { DefaultObservabilityInstance } from './instances';

/**
 * Pins the ordering guarantee the core PulseBridge enrichment relies on (see
 * packages/core/src/pulse/bridge.ts): `emitSpanEnded()` in instances/base.ts
 * emits auto-extracted token/cost metrics BEFORE the SPAN_ENDED tracing event,
 * in the same synchronous call. The bridge caches metric values by spanId and
 * folds them into the semantic model pulse at span_ended — if this ordering
 * ever breaks, the fold silently degrades to shutdown-time fallback pulses,
 * so this test must fail first.
 */

type Observed = { kind: 'metric'; name: string; spanId?: string } | { kind: 'tracing'; type: string; spanType: string };

class OrderRecordingExporter implements ObservabilityExporter {
  name = 'order-recorder';
  observed: Observed[] = [];

  async exportTracingEvent(event: TracingEvent): Promise<void> {
    this.observed.push({ kind: 'tracing', type: event.type, spanType: String(event.exportedSpan.type) });
  }
  async onMetricEvent(event: MetricEvent): Promise<void> {
    this.observed.push({ kind: 'metric', name: event.metric.name, spanId: event.metric.spanId });
  }
  async flush(): Promise<void> {}
  async shutdown(): Promise<void> {}
}

describe('pulse enrichment ordering guarantee (R2)', () => {
  it('delivers token metrics for a model span before its span_ended event', async () => {
    const exporter = new OrderRecordingExporter();
    const tracing = new DefaultObservabilityInstance({
      serviceName: 'test',
      name: 'test-instance',
      sampling: { type: SamplingStrategyType.ALWAYS },
      exporters: [exporter],
    });

    const agentSpan = tracing.startSpan({ type: SpanType.AGENT_RUN, name: 'test-agent' });
    const modelSpan = agentSpan.createChildSpan({ type: SpanType.MODEL_GENERATION, name: "llm: 'mock'" });
    modelSpan.end({
      attributes: {
        provider: 'mock-provider',
        model: 'mock-model-id',
        usage: { inputTokens: 30, outputTokens: 35 },
      },
    });
    agentSpan.end();
    await tracing.flush();

    const modelEndIndex = exporter.observed.findIndex(
      e => e.kind === 'tracing' && e.type === TracingEventType.SPAN_ENDED && e.spanType === SpanType.MODEL_GENERATION,
    );
    const tokenMetricIndexes = exporter.observed
      .map((e, i) => (e.kind === 'metric' && /^mastra_model_.+_tokens$/.test(e.name) ? i : -1))
      .filter(i => i !== -1);

    expect(modelEndIndex).toBeGreaterThan(-1);
    expect(tokenMetricIndexes.length).toBeGreaterThan(0);
    for (const index of tokenMetricIndexes) {
      expect(index).toBeLessThan(modelEndIndex);
    }
    // The metrics carry the span identity the bridge folds by.
    const tokenMetrics = exporter.observed.filter(
      (e): e is Extract<Observed, { kind: 'metric' }> => e.kind === 'metric' && /_tokens$/.test(e.name),
    );
    for (const metric of tokenMetrics) {
      expect(metric.spanId).toBe(modelSpan.id);
    }

    await tracing.shutdown();
  });

  it('delivers token metrics even when the model span itself is export-filtered', async () => {
    const exporter = new OrderRecordingExporter();
    const tracing = new DefaultObservabilityInstance({
      serviceName: 'test',
      name: 'test-instance',
      sampling: { type: SamplingStrategyType.ALWAYS },
      exporters: [exporter],
      excludeSpanTypes: [SpanType.MODEL_GENERATION],
    });

    const agentSpan = tracing.startSpan({ type: SpanType.AGENT_RUN, name: 'test-agent' });
    const modelSpan = agentSpan.createChildSpan({ type: SpanType.MODEL_GENERATION, name: "llm: 'mock'" });
    modelSpan.end({
      attributes: {
        provider: 'mock-provider',
        model: 'mock-model-id',
        usage: { inputTokens: 10, outputTokens: 5 },
      },
    });
    agentSpan.end();
    await tracing.flush();

    // No model span_ended reaches exporters — enrichment survives via the
    // bridge's flush-time fallback, which depends on the metrics still firing.
    expect(
      exporter.observed.some(
        e => e.kind === 'tracing' && e.spanType === SpanType.MODEL_GENERATION && e.type === TracingEventType.SPAN_ENDED,
      ),
    ).toBe(false);
    expect(exporter.observed.some(e => e.kind === 'metric' && /^mastra_model_.+_tokens$/.test(e.name))).toBe(true);

    await tracing.shutdown();
  });
});
