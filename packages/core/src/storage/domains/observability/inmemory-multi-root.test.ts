import { describe, expect, it } from 'vitest';
import { EntityType, SpanType } from '../../../observability/types';
import { InMemoryStore } from '../../mock';
import type { CreateSpanRecord } from './tracing';

const T0 = new Date('2026-01-01T00:00:00.000Z');
const T1 = new Date('2026-01-01T00:05:00.000Z');

function makeRootSpan(spanId: string, startedAt: Date, entityName: string): CreateSpanRecord {
  return {
    traceId: 'trace-multi',
    spanId,
    parentSpanId: null,
    externalParentSpanId: 'outside-parent',
    name: entityName,
    spanType: SpanType.AGENT_RUN,
    isEvent: false,
    entityType: EntityType.AGENT,
    entityName,
    startedAt,
    endedAt: new Date(startedAt.getTime() + 1000),
  };
}

async function seed(...spans: CreateSpanRecord[]) {
  const store = new InMemoryStore();
  const obs = (await store.getStore('observability'))!;
  for (const span of spans) await obs.createSpan({ span });
  return obs;
}

describe('ObservabilityInMemory traces with several roots', () => {
  it('breaks a start-time tie by the lowest span ID', async () => {
    const obs = await seed(makeRootSpan('root-b', T0, 'reviewer'), makeRootSpan('root-a', T0, 'planner'));
    expect((await obs.getRootSpan({ traceId: 'trace-multi' }))?.span.spanId).toBe('root-a');
  });

  it('lists the trace once, under its earliest root', async () => {
    const obs = await seed(makeRootSpan('root-1', T0, 'planner'), makeRootSpan('root-2', T1, 'reviewer'));
    const { spans } = await obs.listTraces({});
    expect(spans.map(span => span.spanId)).toEqual(['root-1']);
  });

  it('finds the trace through a later root and lists it under that root', async () => {
    const obs = await seed(makeRootSpan('root-1', T0, 'planner'), makeRootSpan('root-2', T1, 'reviewer'));

    const byEntity = await obs.listTraces({ filters: { entityName: 'reviewer' } });
    expect(byEntity.spans.map(span => span.spanId)).toEqual(['root-2']);

    const byRange = await obs.listTraces({ filters: { startedAt: { start: T1 } } });
    expect(byRange.spans.map(span => span.spanId)).toEqual(['root-2']);
  });
});
