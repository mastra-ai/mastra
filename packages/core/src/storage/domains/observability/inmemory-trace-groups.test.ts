import { beforeEach, describe, expect, it } from 'vitest';
import { EntityType, SpanType } from '../../../observability/types';
import { InMemoryStore } from '../../mock';
import type { ObservabilityStorage } from './base';

function makeRootSpan(traceId: string, startedAt: Date, overrides: Record<string, unknown> = {}) {
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
    endedAt: new Date(startedAt.getTime() + 1000),
    ...overrides,
  } as any;
}

const at = (min: number) => new Date(Date.UTC(2026, 0, 1, 0, min));

describe('listTraceGroups (in-memory)', () => {
  let obs: ObservabilityStorage;

  beforeEach(async () => {
    const store = new InMemoryStore();
    obs = (await store.getStore('observability'))! as ObservabilityStorage;
    // thread-1: 3 traces, one errored; thread-2: 1 trace; 2 traces without threadId
    await obs.createSpan({ span: makeRootSpan('t1', at(1), { threadId: 'thread-1' }) });
    await obs.createSpan({ span: makeRootSpan('t2', at(2), { threadId: 'thread-1', error: { message: 'boom' } }) });
    await obs.createSpan({ span: makeRootSpan('t3', at(5), { threadId: 'thread-1' }) });
    await obs.createSpan({ span: makeRootSpan('t4', at(3), { threadId: 'thread-2' }) });
    await obs.createSpan({ span: makeRootSpan('t5', at(4)) });
    await obs.createSpan({ span: makeRootSpan('t6', at(6)) });
  });

  describe('when grouping by threadId', () => {
    it('returns one group per distinct threadId with the trace count', async () => {
      const { groups } = await obs.listTraceGroups({ groupBy: 'threadId' });
      const byValue = Object.fromEntries(groups.map(g => [String(g.value), g.count]));
      expect(byValue).toEqual({ 'thread-1': 3, 'thread-2': 1, null: 2 });
    });

    it('collapses traces without a threadId into a single null group', async () => {
      const { groups } = await obs.listTraceGroups({ groupBy: 'threadId' });
      const nullGroups = groups.filter(g => g.value === null);
      expect(nullGroups).toHaveLength(1);
      expect(nullGroups[0]!.count).toBe(2);
    });

    it('reports errorCount for root spans that ended in error', async () => {
      const { groups } = await obs.listTraceGroups({ groupBy: 'threadId' });
      const g1 = groups.find(g => g.value === 'thread-1')!;
      const g2 = groups.find(g => g.value === 'thread-2')!;
      expect(g1.errorCount).toBe(1);
      expect(g2.errorCount).toBe(0);
    });

    it('reports the latest trace of each group', async () => {
      const { groups } = await obs.listTraceGroups({ groupBy: 'threadId' });
      const g1 = groups.find(g => g.value === 'thread-1')!;
      expect(g1.latestTraceId).toBe('t3');
      expect(g1.latestStartedAt).toEqual(at(5));
    });

    it('orders groups by latest activity by default', async () => {
      const { groups } = await obs.listTraceGroups({ groupBy: 'threadId' });
      // null group latest = t6 (min 6), thread-1 latest = t3 (min 5), thread-2 = t4 (min 3)
      expect(groups.map(g => g.value)).toEqual([null, 'thread-1', 'thread-2']);
    });

    it('orders groups by count when requested', async () => {
      const { groups } = await obs.listTraceGroups({
        groupBy: 'threadId',
        orderBy: { field: 'count', direction: 'DESC' },
      });
      expect(groups.map(g => g.count)).toEqual([3, 2, 1]);
    });
  });

  describe('when combined with trace filters', () => {
    it('only counts traces matching the date range', async () => {
      const { groups } = await obs.listTraceGroups({
        groupBy: 'threadId',
        filters: { startedAt: { start: at(3) } },
      });
      const byValue = Object.fromEntries(groups.map(g => [String(g.value), g.count]));
      expect(byValue).toEqual({ 'thread-1': 1, 'thread-2': 1, null: 2 });
    });

    it('respects entity filters', async () => {
      const { groups } = await obs.listTraceGroups({
        groupBy: 'threadId',
        filters: { entityId: 'nope' },
      });
      expect(groups).toEqual([]);
    });
  });

  describe('pagination', () => {
    it('reports total distinct groups and pages through them', async () => {
      const page0 = await obs.listTraceGroups({
        groupBy: 'threadId',
        pagination: { page: 0, perPage: 2 },
      });
      expect(page0.pagination).toEqual({ total: 3, page: 0, perPage: 2, hasMore: true });
      expect(page0.groups).toHaveLength(2);

      const page1 = await obs.listTraceGroups({
        groupBy: 'threadId',
        pagination: { page: 1, perPage: 2 },
      });
      expect(page1.pagination.hasMore).toBe(false);
      expect(page1.groups).toHaveLength(1);
    });
  });

  describe('argument validation', () => {
    it('rejects an unsupported groupBy key', async () => {
      await expect(obs.listTraceGroups({ groupBy: 'metadata.tenant' as any })).rejects.toThrow();
    });
  });
});
