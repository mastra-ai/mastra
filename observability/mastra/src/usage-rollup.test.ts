/**
 * Tests for rolling up internal MODEL_GENERATION usage onto the closest
 * exported ancestor when internal-span filtering is active.
 *
 * The rollup serves two goals:
 *
 *   1. Trace UI visibility — the visible ancestor (e.g. PROCESSOR_RUN) gets
 *      an `internalUsage` attribute summing the tokens consumed by hidden
 *      descendant model calls so users can see processor cost without
 *      needing to enable `includeInternalSpans`.
 *
 *   2. Metric attribution — token / cost metrics still emit, but are
 *      attributed (via labels) to the visible ancestor span instead of
 *      vanishing along with the hidden MODEL_GENERATION.
 */

import { SpanType, SamplingStrategyType, InternalSpans } from '@mastra/core/observability';
import type {
  AnyExportedSpan,
  MetricEvent,
  ObservabilityExporter,
  ProcessorRunAttributes,
  TracingEvent,
} from '@mastra/core/observability';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DefaultObservabilityInstance } from './instances';

class CollectingExporter implements ObservabilityExporter {
  name = 'collector';
  tracingEvents: TracingEvent[] = [];
  metricEvents: MetricEvent[] = [];

  async onTracingEvent(event: TracingEvent): Promise<void> {
    this.tracingEvents.push(event);
  }
  async onMetricEvent(event: MetricEvent): Promise<void> {
    this.metricEvents.push(event);
  }

  endedSpans(): AnyExportedSpan[] {
    return this.tracingEvents.filter(e => e.type === 'span_ended').map(e => e.exportedSpan);
  }

  async shutdown(): Promise<void> {}
  async flush(): Promise<void> {}
}

describe('internal MODEL_GENERATION usage rollup', () => {
  let exporter: CollectingExporter;
  let tracing: DefaultObservabilityInstance;

  beforeEach(() => {
    exporter = new CollectingExporter();
    tracing = new DefaultObservabilityInstance({
      serviceName: 'usage-rollup-test',
      name: 'test-instance',
      sampling: { type: SamplingStrategyType.ALWAYS },
      exporters: [exporter],
    });
  });

  afterEach(async () => {
    await tracing.shutdown();
  });

  it('accumulates internal-model usage onto the closest exported ancestor', async () => {
    const processorSpan = tracing.startSpan({
      type: SpanType.PROCESSOR_RUN,
      name: 'input processor: moderation',
    });

    const hiddenAgent = processorSpan.createChildSpan({
      type: SpanType.AGENT_RUN,
      name: 'agent run: content-moderator',
      tracingPolicy: { internal: InternalSpans.ALL },
    });

    const hiddenModel = hiddenAgent.createChildSpan({
      type: SpanType.MODEL_GENERATION,
      name: "llm: 'mock'",
      tracingPolicy: { internal: InternalSpans.ALL },
    });

    hiddenModel.end({
      attributes: {
        provider: 'mock-provider',
        model: 'mock-model-id',
        usage: { inputTokens: 100, outputTokens: 25 },
      },
    });
    hiddenAgent.end();
    processorSpan.end();
    await tracing.flush();

    // The visible processor span carries an internalUsage summary.
    const ended = exporter.endedSpans();
    const exportedProcessor = ended.find(s => s.type === SpanType.PROCESSOR_RUN);
    expect(exportedProcessor).toBeDefined();
    const attrs = exportedProcessor!.attributes as ProcessorRunAttributes;
    expect(attrs.internalUsage).toEqual({ inputTokens: 100, outputTokens: 25 });

    // Hidden descendants must not be exported.
    expect(ended.some(s => s.type === SpanType.AGENT_RUN)).toBe(false);
    expect(ended.some(s => s.type === SpanType.MODEL_GENERATION)).toBe(false);
  });

  it('sums usage across multiple hidden model calls onto a single ancestor', async () => {
    const processorSpan = tracing.startSpan({
      type: SpanType.PROCESSOR_RUN,
      name: 'input processor: structured-output',
    });
    const hiddenAgent = processorSpan.createChildSpan({
      type: SpanType.AGENT_RUN,
      name: 'agent run: structurer',
      tracingPolicy: { internal: InternalSpans.ALL },
    });

    const m1 = hiddenAgent.createChildSpan({
      type: SpanType.MODEL_GENERATION,
      name: "llm: 'mock'",
      tracingPolicy: { internal: InternalSpans.ALL },
    });
    m1.end({
      attributes: {
        provider: 'p',
        model: 'm',
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          inputDetails: { text: 10 },
          outputDetails: { text: 5 },
        },
      },
    });

    const m2 = hiddenAgent.createChildSpan({
      type: SpanType.MODEL_GENERATION,
      name: "llm: 'mock'",
      tracingPolicy: { internal: InternalSpans.ALL },
    });
    m2.end({
      attributes: {
        provider: 'p',
        model: 'm',
        usage: {
          inputTokens: 30,
          outputTokens: 15,
          inputDetails: { text: 30 },
          outputDetails: { text: 12, reasoning: 3 },
        },
      },
    });

    hiddenAgent.end();
    processorSpan.end();
    await tracing.flush();

    const exportedProcessor = exporter.endedSpans().find(s => s.type === SpanType.PROCESSOR_RUN)!;
    const usage = (exportedProcessor.attributes as ProcessorRunAttributes).internalUsage;
    expect(usage).toEqual({
      inputTokens: 40,
      outputTokens: 20,
      inputDetails: { text: 40 },
      outputDetails: { text: 17, reasoning: 3 },
    });
  });

  it('walks past intermediate internal ancestors to reach an exported span', async () => {
    const visibleAgent = tracing.startSpan({
      type: SpanType.AGENT_RUN,
      name: 'agent run: user-agent',
    });
    const hiddenWorkflow = visibleAgent.createChildSpan({
      type: SpanType.WORKFLOW_RUN,
      name: 'workflow: agentic-loop',
      tracingPolicy: { internal: InternalSpans.ALL },
    });
    const hiddenInnerAgent = hiddenWorkflow.createChildSpan({
      type: SpanType.AGENT_RUN,
      name: 'agent run: inner',
      tracingPolicy: { internal: InternalSpans.ALL },
    });
    const hiddenModel = hiddenInnerAgent.createChildSpan({
      type: SpanType.MODEL_GENERATION,
      name: "llm: 'mock'",
      tracingPolicy: { internal: InternalSpans.ALL },
    });

    hiddenModel.end({
      attributes: { provider: 'p', model: 'm', usage: { inputTokens: 7, outputTokens: 3 } },
    });
    hiddenInnerAgent.end();
    hiddenWorkflow.end();
    visibleAgent.end();
    await tracing.flush();

    // The user-visible AGENT_RUN should be the sole exported span and carry the rolled-up usage.
    const ended = exporter.endedSpans();
    expect(ended).toHaveLength(1);
    const exportedAgent = ended[0]!;
    expect(exportedAgent.type).toBe(SpanType.AGENT_RUN);
    const attrs = exportedAgent.attributes as { internalUsage?: { inputTokens?: number; outputTokens?: number } };
    expect(attrs.internalUsage).toEqual({ inputTokens: 7, outputTokens: 3 });
  });

  it('does not roll up usage when the MODEL_GENERATION itself is exported', async () => {
    const agentSpan = tracing.startSpan({
      type: SpanType.AGENT_RUN,
      name: 'agent run: visible',
    });
    const visibleModel = agentSpan.createChildSpan({
      type: SpanType.MODEL_GENERATION,
      name: "llm: 'mock'",
    });
    visibleModel.end({
      attributes: { provider: 'p', model: 'm', usage: { inputTokens: 50, outputTokens: 10 } },
    });
    agentSpan.end();
    await tracing.flush();

    const ended = exporter.endedSpans();
    const exportedAgent = ended.find(s => s.type === SpanType.AGENT_RUN)!;
    // The visible model emits its own metrics; we must NOT also double-attribute
    // its usage to the agent via internalUsage.
    expect((exportedAgent.attributes as { internalUsage?: unknown }).internalUsage).toBeUndefined();
  });

  it('emits token metrics attributed to the visible ancestor, not the hidden agent', async () => {
    const processorSpan = tracing.startSpan({
      type: SpanType.PROCESSOR_RUN,
      name: 'input processor: moderation',
      entityName: 'Moderation',
      entityId: 'moderation',
    });
    const hiddenAgent = processorSpan.createChildSpan({
      type: SpanType.AGENT_RUN,
      name: 'agent run: content-moderator',
      entityName: 'Content Moderator',
      entityId: 'content-moderator',
      tracingPolicy: { internal: InternalSpans.ALL },
    });
    const hiddenModel = hiddenAgent.createChildSpan({
      type: SpanType.MODEL_GENERATION,
      name: "llm: 'mock'",
      tracingPolicy: { internal: InternalSpans.ALL },
    });
    hiddenModel.end({
      attributes: {
        provider: 'mock-provider',
        model: 'mock-model-id',
        usage: { inputTokens: 100, outputTokens: 25 },
      },
    });
    hiddenAgent.end();
    processorSpan.end();
    await tracing.flush();

    const inputMetric = exporter.metricEvents.find(e => e.metric.name === 'mastra_model_total_input_tokens');
    expect(inputMetric).toBeDefined();
    // Labels point at the processor (the visible ancestor), not the hidden agent.
    expect(inputMetric!.metric.correlationContext.entityId).toBe('moderation');
    expect(inputMetric!.metric.correlationContext.entityName).toBe('Moderation');
    expect(inputMetric!.metric.value).toBe(100);

    const outputMetric = exporter.metricEvents.find(e => e.metric.name === 'mastra_model_total_output_tokens');
    expect(outputMetric).toBeDefined();
    expect(outputMetric!.metric.correlationContext.entityId).toBe('moderation');
    expect(outputMetric!.metric.value).toBe(25);
  });

  it('walks past ancestors filtered by excludeSpanTypes', async () => {
    // A non-internal ancestor that matches `excludeSpanTypes` wouldn't reach
    // exporters either — picking it as the rollup target would silently lose
    // the `internalUsage` attribute. The walk must keep going.
    const localExporter = new CollectingExporter();
    const localTracing = new DefaultObservabilityInstance({
      serviceName: 'usage-rollup-test',
      name: 'test-instance',
      sampling: { type: SamplingStrategyType.ALWAYS },
      excludeSpanTypes: [SpanType.PROCESSOR_RUN],
      exporters: [localExporter],
    });

    const visibleAgent = localTracing.startSpan({
      type: SpanType.AGENT_RUN,
      name: 'agent run: user-agent',
      entityName: 'User Agent',
      entityId: 'user-agent',
    });
    // PROCESSOR_RUN is dropped by excludeSpanTypes — must be skipped during rollup.
    const excludedProcessor = visibleAgent.createChildSpan({
      type: SpanType.PROCESSOR_RUN,
      name: 'input processor: moderation',
    });
    const hiddenAgent = excludedProcessor.createChildSpan({
      type: SpanType.AGENT_RUN,
      name: 'agent run: content-moderator',
      tracingPolicy: { internal: InternalSpans.ALL },
    });
    const hiddenModel = hiddenAgent.createChildSpan({
      type: SpanType.MODEL_GENERATION,
      name: "llm: 'mock'",
      tracingPolicy: { internal: InternalSpans.ALL },
    });

    hiddenModel.end({
      attributes: {
        provider: 'mock-provider',
        model: 'mock-model-id',
        usage: { inputTokens: 42, outputTokens: 9 },
      },
    });
    hiddenAgent.end();
    excludedProcessor.end();
    visibleAgent.end();
    await localTracing.flush();

    // PROCESSOR_RUN is dropped; the rollup landed on the AGENT_RUN above it
    // so both attribute and metric attribution reach an exported span.
    const ended = localExporter.endedSpans();
    expect(ended.some(s => s.type === SpanType.PROCESSOR_RUN)).toBe(false);
    const exportedAgent = ended.find(s => s.type === SpanType.AGENT_RUN)!;
    expect(exportedAgent).toBeDefined();
    expect((exportedAgent.attributes as { internalUsage?: { inputTokens?: number } }).internalUsage).toEqual({
      inputTokens: 42,
      outputTokens: 9,
    });

    const inputMetric = localExporter.metricEvents.find(e => e.metric.name === 'mastra_model_total_input_tokens');
    expect(inputMetric).toBeDefined();
    expect(inputMetric!.metric.correlationContext.entityId).toBe('user-agent');

    await localTracing.shutdown();
  });

  it('does not roll up when includeInternalSpans is true', async () => {
    const localExporter = new CollectingExporter();
    const localTracing = new DefaultObservabilityInstance({
      serviceName: 'usage-rollup-test',
      name: 'test-instance',
      sampling: { type: SamplingStrategyType.ALWAYS },
      includeInternalSpans: true,
      exporters: [localExporter],
    });

    const processorSpan = localTracing.startSpan({
      type: SpanType.PROCESSOR_RUN,
      name: 'input processor: moderation',
    });
    const hiddenAgent = processorSpan.createChildSpan({
      type: SpanType.AGENT_RUN,
      name: 'agent run: content-moderator',
      tracingPolicy: { internal: InternalSpans.ALL },
    });
    const hiddenModel = hiddenAgent.createChildSpan({
      type: SpanType.MODEL_GENERATION,
      name: "llm: 'mock'",
      tracingPolicy: { internal: InternalSpans.ALL },
    });
    hiddenModel.end({
      attributes: {
        provider: 'mock-provider',
        model: 'mock-model-id',
        usage: { inputTokens: 100, outputTokens: 25 },
      },
    });
    hiddenAgent.end();
    processorSpan.end();
    await localTracing.flush();

    // When internal spans are surfaced, the MODEL_GENERATION emits its own
    // metrics via the normal pipeline and we must not also roll its usage
    // onto the processor span.
    const processor = localExporter.endedSpans().find(s => s.type === SpanType.PROCESSOR_RUN)!;
    expect((processor.attributes as { internalUsage?: unknown }).internalUsage).toBeUndefined();

    // All three spans are exported as descendants in the trace.
    const types = localExporter.endedSpans().map(s => s.type);
    expect(types).toContain(SpanType.PROCESSOR_RUN);
    expect(types).toContain(SpanType.AGENT_RUN);
    expect(types).toContain(SpanType.MODEL_GENERATION);

    await localTracing.shutdown();
  });
});
