import {
  EntityType,
  InternalSpans,
  SamplingStrategyType,
  SpanType,
  TracingEventType,
} from '@mastra/core/observability';
import type { TracingEvent } from '@mastra/core/observability';
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

    const rebuilt = tracing.rebuildSpan(JSON.parse(JSON.stringify(agent.exportSpan())));
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
    const rebuilt = tracing.rebuildSpan(JSON.parse(JSON.stringify(span.exportSpan())));
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
