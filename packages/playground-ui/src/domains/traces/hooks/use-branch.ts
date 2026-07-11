import type { LightSpanRecord } from '@mastra/core/storage';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

const IMMUTABLE_CACHE_TIME = 1000 * 60 * 60 * 24 * 30; // 30 days, massive cache, span data is immutable

export interface UseBranchArgs {
  traceId: string | null | undefined;
  spanId: string | null | undefined;
  depth?: number;
}

export function useBranch({
  traceId,
  spanId,
  depth,
}: UseBranchArgs): UseQueryResult<{ traceId: string; spans: LightSpanRecord[] } | null> {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['branch', traceId, spanId, depth],
    queryFn: async () => {
      if (!traceId || !spanId) {
        throw new Error('traceId and spanId are required');
      }
      return client.getBranch({ traceId, spanId, depth });
    },
    enabled: !!traceId && !!spanId,
    staleTime: query => {
      const data = query.state.data;
      const isFinished = data?.spans.every(s => Boolean(s.endedAt));
      return isFinished ? IMMUTABLE_CACHE_TIME : 0;
    },
  });
}
