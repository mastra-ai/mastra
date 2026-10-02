import { parseTraceQueryRequest, planTraceQuery } from '@mastra/core/storage';
import { expect, it, vi } from 'vitest';
import type { DbClient } from '../../../client';
import { queryTraces } from './trace-query';

// Older core versions support list delta polling but lack trace-query delta helpers.
vi.mock('@mastra/core/features', () => ({ coreFeatures: new Set(['observability-delta-polling']) }));
vi.mock('@mastra/core/storage', async importOriginal => ({
  ...(await importOriginal<typeof import('@mastra/core/storage')>()),
  encodeTraceQueryDeltaCursor: undefined,
}));

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
