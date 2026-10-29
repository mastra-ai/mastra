import { parseTraceQueryRequest, planTraceQuery } from '@mastra/core/storage';
import { expect, it, vi } from 'vitest';
import type { DuckDBConnection } from '../../db/index';
import { timingFeatures } from '../../features';
import { queryTraces } from './trace-query';

// Older core versions support list delta polling but lack trace-query delta helpers and the timing fields.
vi.mock('@mastra/core/features', () => ({ coreFeatures: new Set(['observability-delta-polling']) }));
vi.mock('@mastra/core/storage', async importOriginal => {
  const core = await importOriginal<typeof import('@mastra/core/storage')>();
  const { timeToFirstChunkMs: _chunk, timeToFirstTokenMs: _token, ...trace } = core.TRACE_QUERY_FIELD_REGISTRY.trace;
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

it('neither returns nor advertises the timing fields when core predates them', async () => {
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
      timeToFirstTokenMs: 120,
    },
  ]);
  const result = await queryTraces({ query } as unknown as DuckDBConnection, keyset);
  if (!('traces' in result)) throw new Error('Expected traces');
  expect(result.traces[0]).not.toHaveProperty('timeToFirstChunkMs');
  expect(result.traces[0]).not.toHaveProperty('timeToFirstTokenMs');
  expect(timingFeatures).toEqual([]);
});

it('returns the timing fields without advertising their sort when core cannot plan the sort', async () => {
  vi.resetModules();
  vi.doMock('@mastra/core/storage', async importOriginal => ({
    ...(await importOriginal<typeof import('@mastra/core/storage')>()),
    TRACE_QUERY_ORDER_FIELDS: undefined,
  }));
  const features = await import('../../features');
  expect(features.timingFeatures).toEqual(['trace-query-time-to-first-chunk', 'trace-query-time-to-first-token']);
});

it('keeps time to first chunk and leaves out time to first token when core predates only the token field', async () => {
  vi.resetModules();
  vi.doMock('@mastra/core/storage', async importOriginal => {
    const core = await importOriginal<typeof import('@mastra/core/storage')>();
    const { timeToFirstTokenMs: _, ...trace } = core.TRACE_QUERY_FIELD_REGISTRY.trace;
    return {
      ...core,
      TRACE_QUERY_ORDER_FIELDS: ['startedAt', 'endedAt', 'timeToFirstChunkMs'],
      TRACE_QUERY_FIELD_REGISTRY: { ...core.TRACE_QUERY_FIELD_REGISTRY, trace },
    };
  });
  const features = await import('../../features');
  expect(features.timingFeatures).toEqual(['trace-query-time-to-first-chunk', 'trace-query-time-to-first-chunk-sort']);

  const { queryTraces: queryWithChunkOnly } = await import('./trace-query');
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
      timeToFirstTokenMs: 120,
    },
  ]);
  const result = await queryWithChunkOnly(
    { query } as unknown as DuckDBConnection,
    planTraceQuery(parseTraceQueryRequest({ timeRange: { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' } })),
  );
  if (!('traces' in result)) throw new Error('Expected traces');
  expect(result.traces[0]).toMatchObject({ timeToFirstChunkMs: 250 });
  expect(result.traces[0]).not.toHaveProperty('timeToFirstTokenMs');
});
