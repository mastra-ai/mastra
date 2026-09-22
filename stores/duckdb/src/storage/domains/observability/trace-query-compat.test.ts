import { parseTraceQueryRequest, planTraceQuery } from '@mastra/core/storage';
import { expect, it, vi } from 'vitest';
import type { DuckDBConnection } from '../../db/index';
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
  const query = vi.fn().mockResolvedValue([{ total: 0, streamHead: 7 }]);
  const result = await queryTraces({ query } as unknown as DuckDBConnection, page);
  expect(query).toHaveBeenCalledTimes(1);
  expect(result).toEqual({
    traces: [],
    pagination: { page: 0, perPage: 10, total: 0, hasMore: false },
  });
});
