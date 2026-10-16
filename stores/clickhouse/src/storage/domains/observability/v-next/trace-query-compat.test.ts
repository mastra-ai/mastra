import type { ClickHouseClient } from '@clickhouse/client';
import { parseTraceQueryRequest, planTraceQuery } from '@mastra/core/storage';
import { expect, it, vi } from 'vitest';
import { queryTraces, timeToFirstChunkFeatures } from './trace-query';

// Older core versions support list delta polling but lack trace-query delta helpers and time to first chunk.
vi.mock('@mastra/core/features', () => ({ coreFeatures: new Set(['observability-delta-polling']) }));
vi.mock('@mastra/core/storage', async importOriginal => {
  const core = await importOriginal<typeof import('@mastra/core/storage')>();
  const { timeToFirstChunkMs: _, ...trace } = core.TRACE_QUERY_FIELD_REGISTRY.trace;
  return {
    ...core,
    encodeTraceQueryDeltaCursor: undefined,
    TRACE_QUERY_FIELD_REGISTRY: { ...core.TRACE_QUERY_FIELD_REGISTRY, trace },
  };
});

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
  };
  const query = vi.fn().mockResolvedValue({ json: async () => [row] });
  const result = await queryTraces({ query } as unknown as ClickHouseClient, keyset, 15_000, 'serial');
  if (!('traces' in result)) throw new Error('Expected traces');
  expect(result.traces[0]).not.toHaveProperty('timeToFirstChunkMs');
  expect(timeToFirstChunkFeatures).toEqual([]);
});
