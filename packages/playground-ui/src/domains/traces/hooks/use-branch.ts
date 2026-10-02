import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import type { LightSpanRecord } from '../types';

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
    // A finished subtree can still gain spans from a resumed run or delayed export.
    staleTime: 0,
  });
}
