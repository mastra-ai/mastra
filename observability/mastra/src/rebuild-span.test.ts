import { RequestContext } from '@mastra/core/di';
import { InternalSpans, SamplingStrategyType, SpanType, TracingEventType } from '@mastra/core/observability';
import type { ExportedSpan, TracingEvent } from '@mastra/core/observability';
import { describe, expect, it } from 'vitest';
import { DefaultObservabilityInstance } from './instances';

function setup(includeInternalSpans?: boolean) {
  const events: TracingEvent[] = [];
  const tracing = new DefaultObservabilityInstance({
    serviceName: 's',
    name: 'i',
    sampling: { type: SamplingStrategyType.ALWAYS },
    includeInternalSpans,
    exporters: [{ name: 'capture', exportTracingEvent: async e => void events.push(e), shutdown: async () => {} }],
  });
  const agent = tracing.startSpan({ type: SpanType.AGENT_RUN, name: 'agent' });
  const ended = async () => {
    await new Promise(r => setTimeout(r, 10));
    return events.filter(e => e.type === TracingEventType.SPAN_ENDED).map(e => e.exportedSpan.name);
  };
  return { tracing, agent, ended };
}

describe('rebuildSpan internal status', () => {
  it('keeps an internal span internal after export/rebuild', async () => {
    const { tracing, agent, ended } = setup();
    const span = tracing.startSpan({
      type: SpanType.WORKFLOW_STEP,
      name: 'rebuilt',
      parent: agent,
      tracingPolicy: { internal: InternalSpans.WORKFLOW },
    });
    const rebuilt = tracing.rebuildSpan(JSON.parse(JSON.stringify(span.exportSpan())));
    expect(rebuilt.isInternal).toBe(true);
    rebuilt.end();
    expect(await ended()).toEqual([]);
  });

  it('keeps a nested run nested after export/rebuild', () => {
    const { tracing } = setup();
    const span = tracing.startSpan({
      type: SpanType.WORKFLOW_RUN,
      name: 'nested',
      tracingOptions: {
        traceId: '0123456789abcdef0123456789abcdef',
        parentSpanId: '0123456789abcdef',
        nestUnderParent: true,
      },
    });
    const rebuilt = tracing.rebuildSpan(JSON.parse(JSON.stringify(span.exportSpan())));
    expect(rebuilt.exportSpan()?.nestedUnderParent).toBe(true);
    expect(rebuilt.exportSpan()?.externalParentSpanId).toBe('0123456789abcdef');
    rebuilt.end();
  });

  it('leaves non-internal spans unchanged', async () => {
    const { tracing, agent, ended } = setup();
    const span = tracing.startSpan({ type: SpanType.WORKFLOW_STEP, name: 'normal', parent: agent });
    const exported = span.exportSpan();
    expect('isInternal' in exported).toBe(false);
    const rebuilt = tracing.rebuildSpan(JSON.parse(JSON.stringify(exported)));
    expect(rebuilt.isInternal).toBe(false);
    rebuilt.end();
    expect(await ended()).toEqual(['normal']);
  });

  it('exports rebuilt internal spans when includeInternalSpans is enabled', async () => {
    const { tracing, agent, ended } = setup(true);
    const span = tracing.startSpan({
      type: SpanType.WORKFLOW_STEP,
      name: 'rebuilt',
      parent: agent,
      tracingPolicy: { internal: InternalSpans.WORKFLOW },
    });
    const rebuilt = tracing.rebuildSpan(JSON.parse(JSON.stringify(span.exportSpan())));
    expect(rebuilt.isInternal).toBe(true);
    rebuilt.end();
    expect(await ended()).toEqual(['rebuilt']);
  });
});

/**
 * Durable agents and the Inngest engine serialize a span with `exportSpan()` and
 * restore it with `rebuildSpan()` in a later step. Every span created under the
 * rebuilt span inherits its `traceState`, so a rebuild that drops it silently
 * turns off `requestContextKeys` extraction and `hideInput`/`hideOutput` for the
 * rest of the run. (#28111)
 */
describe('rebuildSpan trace state', () => {
  const roundTrip = <T extends SpanType>(span: { exportSpan(): ExportedSpan<T> }) =>
    JSON.parse(JSON.stringify(span.exportSpan())) as ExportedSpan<T>;

  it('keeps extracting requestContextKeys for spans created under a rebuilt span', () => {
    const tracing = new DefaultObservabilityInstance({
      serviceName: 's',
      name: 'i',
      sampling: { type: SamplingStrategyType.ALWAYS },
      requestContextKeys: ['tenant'],
      exporters: [],
    });
    const agentContext = new RequestContext([['tenant', 'acme']]);
    // `job` is a per-request key, so only the exported traceState knows about it
    const agent = tracing.startSpan({
      type: SpanType.AGENT_RUN,
      name: 'agent',
      requestContext: agentContext,
      tracingOptions: { requestContextKeys: ['job'] },
    });
    const step = agent.createChildSpan({ type: SpanType.MODEL_STEP, name: 'step', requestContext: agentContext });

    // A workflow started by a tool sets its own key only in its request context
    const jobContext = new RequestContext([
      ['tenant', 'acme'],
      ['job', 'review'],
    ]);
    const rebuiltStep = tracing.rebuildSpan(roundTrip(step));
    const child = rebuiltStep.createChildSpan({ type: SpanType.GENERIC, name: 'child', requestContext: jobContext });
    const grandchild = child.createChildSpan({
      type: SpanType.GENERIC,
      name: 'grandchild',
      requestContext: jobContext,
    });

    expect(rebuiltStep.traceState).toEqual(step.traceState);
    expect(child.metadata).toEqual({ tenant: 'acme', job: 'review' });
    expect(grandchild.metadata).toEqual({ tenant: 'acme', job: 'review' });
  });

  it('keeps honouring hideInput and hideOutput after a rebuild', () => {
    const tracing = new DefaultObservabilityInstance({
      serviceName: 's',
      name: 'i',
      sampling: { type: SamplingStrategyType.ALWAYS },
      exporters: [],
    });
    const agent = tracing.startSpan({
      type: SpanType.AGENT_RUN,
      name: 'agent',
      input: { secret: 'prompt' },
      tracingOptions: { hideInput: true, hideOutput: true },
    });
    const step = agent.createChildSpan({ type: SpanType.MODEL_STEP, name: 'step' });

    // The durable loop ends the run's root spans through a rebuilt span
    const rebuiltAgent = tracing.rebuildSpan(roundTrip(agent));
    rebuiltAgent.end({ output: { text: 'secret answer' } });
    expect(rebuiltAgent.exportSpan().input).toBeUndefined();
    expect(rebuiltAgent.exportSpan().output).toBeUndefined();

    // A tool call runs under the rebuilt model step
    const tool = tracing
      .rebuildSpan(roundTrip(step))
      .createChildSpan({ type: SpanType.TOOL_CALL, name: 'tool', input: { secret: 'x' } });
    tool.end({ output: { secret: 'y' } });
    expect(tool.exportSpan().input).toBeUndefined();
    expect(tool.exportSpan().output).toBeUndefined();
  });

  it('keeps a nested run nested and still extracting its keys', () => {
    const tracing = new DefaultObservabilityInstance({
      serviceName: 's',
      name: 'i',
      sampling: { type: SamplingStrategyType.ALWAYS },
      requestContextKeys: ['tenant'],
      exporters: [],
    });
    const span = tracing.startSpan({
      type: SpanType.WORKFLOW_RUN,
      name: 'nested',
      tracingOptions: {
        traceId: '0123456789abcdef0123456789abcdef',
        parentSpanId: '0123456789abcdef',
        nestUnderParent: true,
      },
    });
    const rebuilt = tracing.rebuildSpan(roundTrip(span));
    const child = rebuilt.createChildSpan({
      type: SpanType.WORKFLOW_STEP,
      name: 'step',
      requestContext: new RequestContext([['tenant', 'acme']]),
    });
    expect(rebuilt.exportSpan().nestedUnderParent).toBe(true);
    expect(child.exportSpan().nestedUnderParent).toBe(true);
    expect(child.metadata).toEqual({ tenant: 'acme' });
  });

  it('falls back to the configured keys for a span exported before traceState was serialized', () => {
    const tracing = new DefaultObservabilityInstance({
      serviceName: 's',
      name: 'i',
      sampling: { type: SamplingStrategyType.ALWAYS },
      requestContextKeys: ['tenant'],
      exporters: [],
    });
    const agent = tracing.startSpan({ type: SpanType.AGENT_RUN, name: 'agent' });
    const { traceState: _dropped, ...legacy } = roundTrip(agent);
    const child = tracing.rebuildSpan(legacy as ExportedSpan<SpanType.AGENT_RUN>).createChildSpan({
      type: SpanType.GENERIC,
      name: 'child',
      requestContext: new RequestContext([['tenant', 'acme']]),
    });
    expect(child.metadata).toEqual({ tenant: 'acme' });
  });
});
