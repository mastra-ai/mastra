import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';
import type { LightSpanRecord } from './types';

const IMMUTABLE_CACHE_TIME = 1000 * 60 * 60 * 24 * 30; // 30 days, massive cache, span data is immutable

type TraceLightSpansResponse = { traceId: string; spans: LightSpanRecord[] } | null;

/**
 * Does not guard on empty ids; pass `queryOptions: { enabled }` to skip the fetch.
 */
export function useTraceLightSpans<TData = TraceLightSpansResponse>({
  traceId,
  queryOptions,
}: {
  traceId: string | null | undefined;
  queryOptions?: MastraQueryOptions<TraceLightSpansResponse, TData>;
}): UseQueryResult<TData, Error> {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['trace-light-spans', traceId],
    queryFn: async (): Promise<TraceLightSpansResponse> => {
      if (!traceId) {
        throw new Error('Trace ID is required');
      }
      const res = await client.getTraceLight(traceId);
      return res;
    },
    staleTime: query => {
      const data = query.state.data;

      const isFinished = data?.spans.every(d => Boolean(d.endedAt));

      if (isFinished) {
        return IMMUTABLE_CACHE_TIME;
      }

      return 0;
    },
    ...queryOptions,
  });
}
