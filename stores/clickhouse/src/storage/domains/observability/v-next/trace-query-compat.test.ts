import type { ClickHouseClient } from '@clickhouse/client';
import { parseTraceQueryRequest, planSpanQuery, planTraceQuery } from '@mastra/core/storage';
import { expect, it, vi } from 'vitest';
import { querySpans } from './span-query';
import { queryTraces, timeToFirstChunkFeatures } from './trace-query';

// Older core versions support list delta polling but lack trace-query delta helpers and the trace-query
// field registry (added in core 1.68), so they know nothing about time to first chunk.
vi.mock('@mastra/core/features', () => ({ coreFeatures: new Set(['observability-delta-polling']) }));
vi.mock('@mastra/core/storage', async importOriginal => ({
  ...(await importOriginal<typeof import('@mastra/core/storage')>()),
  encodeTraceQueryDeltaCursor: undefined,
  TRACE_QUERY_FIELD_REGISTRY: undefined,
}));

it('returns numbered pages when core supports list polling but lacks the query cursor encoder', async () => {
  const page = planTraceQuery(
    parseTraceQueryRequest({
      timeRange: { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' },
      pagination: { page: 0, perPage: 10 },
    }),
  );
  const query = vi.fn().mockImplementation(async ({ query: sql }: { query: string }) => ({
    json: async () => (sql.includes('ORDER BY cursorId DESC') ? [{ cursorId: '7', traceId: '' }] : []),
  }));
  const result = await queryTraces({ query } as unknown as ClickHouseClient, page, 15_000, 'serial');
  expect(query).toHaveBeenCalledTimes(1);
  expect(result).toEqual({
    traces: [],
    pagination: { page: 0, perPage: 10, total: 0, hasMore: false },
  });
});

it('neither returns nor advertises time to first chunk when core predates the field', async () => {
  const keyset = planTraceQuery(
    parseTraceQueryRequest({ timeRange: { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' } }),
  );
  const row = {
    traceId: 'trace-a',
    rootSpanId: 'root',
    name: 'run',
    startedAt: '2026-01-01T10:00:00.000Z',
    endedAt: '2026-01-01T10:00:01.000Z',
    status: 'success',
    inputPreview: '',
    outputPreview: '',
    errorPreview: '',
    timeToFirstChunkMs: 250,
    // The key query and the row query both read this mock.
    dedupeKey: 'trace-a',
    sortValue: '2026-01-01T10:00:00.000Z',
    rootStartedAt: '2026-01-01T10:00:00.000Z',
    rootEndedAt: '2026-01-01T10:00:01.000Z',
  };
  const query = vi.fn().mockResolvedValue({ json: async () => [row] });
  const result = await queryTraces({ query } as unknown as ClickHouseClient, keyset, 15_000, 'serial');
  if (!('traces' in result)) throw new Error('Expected traces');
  expect(result.traces[0]).not.toHaveProperty('timeToFirstChunkMs');
  expect(timeToFirstChunkFeatures).toEqual([]);
});

it('returns spans without time to first chunk when core predates the field', async () => {
  const plan = planSpanQuery({ timeRange: { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' } });
  const identity = {
    organizationId: null,
    resourceId: null,
    traceId: 'trace-a',
    spanId: 'span-a',
    startedAt: '2026-01-01 10:00:00.000',
    endedAt: '2026-01-01 10:00:01.000',
  };
  const stored = {
    ...identity,
    parentSpanId: null,
    name: 'run',
    spanType: 'agent_run',
    entityType: null,
    entityId: null,
    entityName: null,
    model: null,
    provider: null,
    durationMs: '1000',
    timeToFirstChunkMs: 250,
    status: 'success',
    inputPreview: '',
    outputPreview: '',
    errorPreview: '',
  };
  const query = vi.fn().mockImplementation(async ({ query: sql }: { query: string }) => ({
    json: async () => (sql.includes('WITH candidates') ? [identity] : sql.includes('mastra_model_') ? [] : [stored]),
  }));
  const result = await querySpans({ query } as unknown as ClickHouseClient, plan, 15_000);
  expect(result.spans).toHaveLength(1);
  expect(result.spans[0]).not.toHaveProperty('timeToFirstChunkMs');
});

it('advertises time to first chunk without its sort when core predates the sort', async () => {
  vi.resetModules();
  vi.doMock('@mastra/core/storage', async importOriginal => ({
    ...(await importOriginal<typeof import('@mastra/core/storage')>()),
    TRACE_QUERY_ORDER_FIELDS: undefined,
  }));
  const { timeToFirstChunkFeatures: features } = await import('./trace-query');
  expect(features).toEqual(['trace-query-time-to-first-chunk']);
});
