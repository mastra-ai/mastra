import { parseTraceQueryRequest, planTraceQuery } from '@mastra/core/storage';
import { expect, it, vi } from 'vitest';
import type { DbClient } from '../../../client';
import { queryTraces, timeToFirstChunkFeatures } from './trace-query';

// Older core versions support list delta polling but lack trace-query delta helpers and
// `timeToFirstChunkMs`, which their strict query result schemas reject and cannot sort by.
vi.mock('@mastra/core/features', () => ({ coreFeatures: new Set(['observability-delta-polling']) }));
vi.mock('@mastra/core/storage', async importOriginal => {
  const original = await importOriginal<typeof import('@mastra/core/storage')>();
  const { timeToFirstChunkMs: _, ...trace } = original.TRACE_QUERY_FIELD_REGISTRY.trace;
  return {
    ...original,
    encodeTraceQueryDeltaCursor: undefined,
    TRACE_QUERY_ORDER_FIELDS: undefined,
    TRACE_QUERY_FIELD_REGISTRY: { ...original.TRACE_QUERY_FIELD_REGISTRY, trace },
  };
});

it('returns numbered pages when core supports list polling but lacks the query cursor encoder', async () => {
  const page = planTraceQuery(
    parseTraceQueryRequest({
      timeRange: { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' },
      pagination: { page: 0, perPage: 10 },
    }),
  );
  const query = vi.fn().mockResolvedValue({ rows: [] });
  const any = vi
    .fn()
    .mockResolvedValueOnce([{ count: '0' }])
    .mockResolvedValueOnce([]);
  const one = vi.fn().mockResolvedValue({ xactId: '7' });
  const tx = vi.fn(async callback => callback({ query, any, one }));
  const result = await queryTraces({ tx } as unknown as DbClient, 'public', page, 15_000);
  expect(any).toHaveBeenCalledTimes(2);
  expect(one).not.toHaveBeenCalled();
  expect(result).toEqual({
    traces: [],
    pagination: { page: 0, perPage: 10, total: 0, hasMore: false },
  });
});

it('neither returns, advertises nor sorts by time to first chunk when core predates the field', async () => {
  const page = planTraceQuery(
    parseTraceQueryRequest({
      timeRange: { from: '2026-01-01T00:00:00Z', to: '2026-01-02T00:00:00Z' },
      pagination: { page: 0, perPage: 10 },
    }),
  );
  const row = {
    traceId: 'trace',
    rootSpanId: 'root',
    name: 'agent',
    startedAt: new Date('2026-01-01T00:00:00Z'),
    endedAt: new Date('2026-01-01T00:00:01Z'),
    status: 'success',
    inputPreview: '',
    outputPreview: '',
    errorPreview: '',
    timeToFirstChunkMs: 250,
  };
  const any = vi
    .fn()
    .mockResolvedValueOnce([{ count: '1' }])
    .mockResolvedValueOnce([row]);
  const tx = vi.fn(async callback => callback({ query: vi.fn(), any }));
  const result = await queryTraces({ tx } as unknown as DbClient, 'public', page, 15_000);
  if (!('traces' in result)) throw new Error('Expected traces');
  expect(result.traces[0]).not.toHaveProperty('timeToFirstChunkMs');
  expect(timeToFirstChunkFeatures).toEqual([]);
});
