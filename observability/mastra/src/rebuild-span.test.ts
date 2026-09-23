import { InternalSpans, SamplingStrategyType, SpanType, TracingEventType } from '@mastra/core/observability';
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
