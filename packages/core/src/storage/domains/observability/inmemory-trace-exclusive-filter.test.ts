import { describe, expect, it } from 'vitest';
import { EntityType, SpanType } from '../../../observability/types';
import { InMemoryStore } from '../../mock';

function makeRootSpan(traceId: string, startedAt: Date) {
  return {
    traceId,
    spanId: `${traceId}-root`,
    parentSpanId: null,
    name: 'agent-run',
    spanType: SpanType.AGENT_RUN,
    isEvent: false,
    entityType: EntityType.AGENT,
    entityId: 'agent-1',
    entityName: 'myAgent',
    userId: null,
    organizationId: null,
    resourceId: null,
    runId: null,
    sessionId: null,
    threadId: null,
    requestId: null,
    environment: 'test',
    source: null,
    serviceName: 'test-service',
    scope: null,
    attributes: {},
    metadata: {},
    tags: [],
    links: null,
    input: null,
    output: null,
    error: null,
    startedAt,
    endedAt: null,
  } as any;
}

const T0 = new Date('2026-01-01T00:00:00.000Z');
const T1 = new Date('2026-01-02T00:00:00.000Z');

async function seedTraces() {
  const store = new InMemoryStore();
  const obs = (await store.getStore('observability'))!;
  await obs.createSpan({ span: makeRootSpan('trace-A', T0) });
  await obs.createSpan({ span: makeRootSpan('trace-B', T1) });
  return obs;
}

describe('ObservabilityInMemory listTraces startExclusive/endExclusive', () => {
  it('startExclusive excludes a trace whose startedAt equals the boundary', async () => {
    const obs = await seedTraces();

    const inclusive = await obs.listTraces({ filters: { startedAt: { start: T1 } } });
    expect(inclusive.spans.map((s: any) => s.traceId)).toContain('trace-B');

    const exclusive = await obs.listTraces({ filters: { startedAt: { start: T1, startExclusive: true } } });
    expect(exclusive.spans.map((s: any) => s.traceId)).not.toContain('trace-B');
  });

  it('endExclusive excludes a trace whose startedAt equals the end boundary', async () => {
    const obs = await seedTraces();

    const inclusive = await obs.listTraces({ filters: { startedAt: { end: T0 } } });
    expect(inclusive.spans.map((s: any) => s.traceId)).toContain('trace-A');

    const exclusive = await obs.listTraces({ filters: { startedAt: { end: T0, endExclusive: true } } });
    expect(exclusive.spans.map((s: any) => s.traceId)).not.toContain('trace-A');
  });
});
