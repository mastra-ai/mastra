import { RequestContext } from '@mastra/core/di';
import {
  EntityType,
  InternalSpans,
  SamplingStrategyType,
  SpanType,
  TracingEventType,
} from '@mastra/core/observability';
import type { SpanSnapshot, TracingEvent } from '@mastra/core/observability';
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

  it('keeps the parent and root entity of a rebuilt nested span and of children created under it', async () => {
    const events: TracingEvent[] = [];
    const tracing = new DefaultObservabilityInstance({
      serviceName: 's',
      name: 'i',
      sampling: { type: SamplingStrategyType.ALWAYS },
      exporters: [{ name: 'capture', exportTracingEvent: async e => void events.push(e), shutdown: async () => {} }],
    });
    const workflow = tracing.startSpan({
      type: SpanType.WORKFLOW_RUN,
      name: 'workflow',
      entityType: EntityType.WORKFLOW_RUN,
      entityId: 'wf',
      entityName: 'Workflow',
      metadata: { entityVersionId: 'wf-v1' },
    });
    const agent = tracing.startSpan({
      type: SpanType.AGENT_RUN,
      name: 'agent',
      parent: workflow,
      entityType: EntityType.AGENT,
      entityId: 'support',
      entityName: 'Support',
    });

    const rebuilt = tracing.rebuildSpan(JSON.parse(JSON.stringify(agent.snapshot())));
    const tool = tracing.startSpan({
      type: SpanType.TOOL_CALL,
      name: 'tool',
      parent: rebuilt,
      entityType: EntityType.TOOL,
      entityId: 'lookup',
      entityName: 'lookup',
    });
    tool.end();
    rebuilt.end();
    await new Promise(r => setTimeout(r, 10));
    const endedSpan = (name: string) =>
      events.find(e => e.type === TracingEventType.SPAN_ENDED && e.exportedSpan.name === name)?.exportedSpan;

    const workflowLineage = {
      rootEntityType: EntityType.WORKFLOW_RUN,
      rootEntityId: 'wf',
      rootEntityName: 'Workflow',
      rootEntityVersionId: 'wf-v1',
    };
    expect(endedSpan('agent')).toMatchObject({
      parentEntityType: EntityType.WORKFLOW_RUN,
      parentEntityId: 'wf',
      parentEntityName: 'Workflow',
      parentEntityVersionId: 'wf-v1',
      ...workflowLineage,
    });
    expect(endedSpan('tool')).toMatchObject({
      parentEntityType: EntityType.AGENT,
      parentEntityId: 'support',
      parentEntityName: 'Support',
      ...workflowLineage,
    });
    // The agent has no version of its own; it only inherited the workflow's through metadata
    expect(endedSpan('tool')?.parentEntityVersionId).toBeUndefined();
  });

  it('falls back to the restored parent entity when the rebuilt ancestor is internal', async () => {
    const { tracing, ended } = setup();
    const agent = tracing.startSpan({
      type: SpanType.AGENT_RUN,
      name: 'owner',
      entityType: EntityType.AGENT,
      entityId: 'support',
      entityName: 'Support',
    });
    const span = tracing.startSpan({
      type: SpanType.WORKFLOW_STEP,
      name: 'internal-step',
      parent: agent,
      entityType: EntityType.WORKFLOW_STEP,
      entityId: 'step',
      entityName: 'step',
      tracingPolicy: { internal: InternalSpans.WORKFLOW },
    });
    const rebuilt = tracing.rebuildSpan(JSON.parse(JSON.stringify(span.snapshot())));
    const child = tracing.startSpan({ type: SpanType.TOOL_CALL, name: 'child', parent: rebuilt });
    // The internal rebuilt step is skipped, so the parent entity is the step's own restored parent.
    expect(child.exportSpan()).toMatchObject({
      parentEntityType: EntityType.AGENT,
      parentEntityName: 'Support',
      rootEntityType: EntityType.AGENT,
      rootEntityName: 'Support',
    });
    child.end();
    rebuilt.end();
    agent.end();
    expect(await ended()).toEqual(['child', 'owner']);
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
  const roundTrip = <T extends SpanType>(span: { snapshot(): SpanSnapshot<T> }) =>
    JSON.parse(JSON.stringify(span.snapshot())) as SpanSnapshot<T>;

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
    // Exporters never see the trace state
    expect(step.exportSpan()).not.toHaveProperty('traceState');
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

  it('falls back to the configured keys for a span saved with exportSpan() instead of snapshot()', () => {
    const tracing = new DefaultObservabilityInstance({
      serviceName: 's',
      name: 'i',
      sampling: { type: SamplingStrategyType.ALWAYS },
      requestContextKeys: ['tenant'],
      exporters: [],
    });
    const agent = tracing.startSpan({ type: SpanType.AGENT_RUN, name: 'agent' });
    const legacy = JSON.parse(JSON.stringify(agent.exportSpan()));
    const child = tracing.rebuildSpan(legacy).createChildSpan({
      type: SpanType.GENERIC,
      name: 'child',
      requestContext: new RequestContext([['tenant', 'acme']]),
    });
    expect(child.metadata).toEqual({ tenant: 'acme' });
  });
});
