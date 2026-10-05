import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';
import type { LightSpanRecord } from './types';

export type BranchResponse = { traceId: string; spans: LightSpanRecord[] } | null;

export interface UseBranchArgs<TData = BranchResponse> {
  traceId: string | null | undefined;
  spanId: string | null | undefined;
  depth?: number;
  queryOptions?: MastraQueryOptions<BranchResponse, TData>;
}

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export function useBranch<TData = BranchResponse>({
  traceId,
  spanId,
  depth,
  queryOptions,
}: UseBranchArgs<TData>): UseQueryResult<TData, Error> {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['branch', traceId, spanId, depth],
    queryFn: async (): Promise<BranchResponse> => {
      if (!traceId || !spanId) {
        throw new Error('traceId and spanId are required');
      }
      return client.getBranch({ traceId, spanId, depth });
    },
    // A finished subtree can still gain spans from a resumed run or delayed export.
    staleTime: 0,
    ...queryOptions,
  });
}
