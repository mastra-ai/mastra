import { parseTraceQueryRequest, planTraceQuery } from '@mastra/core/storage';
import { expect, it, vi } from 'vitest';
import type { DuckDBConnection } from '../../db/index';
import { timeToFirstChunkFeatures } from '../../features';
import { queryTraces } from './trace-query';

// Older core versions support list delta polling but lack trace-query delta helpers and time to first chunk.
vi.mock('@mastra/core/features', () => ({ coreFeatures: new Set(['observability-delta-polling']) }));
vi.mock('@mastra/core/storage', async importOriginal => {
  const core = await importOriginal<typeof import('@mastra/core/storage')>();
  const { timeToFirstChunkMs: _, ...trace } = core.TRACE_QUERY_FIELD_REGISTRY.trace;
  return {
    ...core,
    encodeTraceQueryDeltaCursor: undefined,
    TRACE_QUERY_ORDER_FIELDS: undefined,
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
  const query = vi.fn().mockResolvedValue([{ total: 0, streamHead: 7 }]);
  const result = await queryTraces({ query } as unknown as DuckDBConnection, page);
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
  const startedAt = new Date('2026-01-01T10:00:00Z');
  const query = vi.fn().mockResolvedValue([
    {
      traceId: 'trace-a',
      rootSpanId: 'root',
      name: 'run',
      startedAt,
      endedAt: startedAt,
      status: 'success',
      metadata: null,
      inputPreview: '',
      outputPreview: '',
      errorPreview: '',
      timeToFirstChunkMs: 250,
    },
  ]);
  const result = await queryTraces({ query } as unknown as DuckDBConnection, keyset);
  if (!('traces' in result)) throw new Error('Expected traces');
  expect(result.traces[0]).not.toHaveProperty('timeToFirstChunkMs');
  expect(timeToFirstChunkFeatures).toEqual([]);
});

it('returns time to first chunk without advertising its sort when core cannot plan the sort', async () => {
  vi.resetModules();
  vi.doMock('@mastra/core/storage', async importOriginal => ({
    ...(await importOriginal<typeof import('@mastra/core/storage')>()),
    TRACE_QUERY_ORDER_FIELDS: undefined,
  }));
  const features = await import('../../features');
  expect(features.timeToFirstChunkFeatures).toEqual(['trace-query-time-to-first-chunk']);
});
