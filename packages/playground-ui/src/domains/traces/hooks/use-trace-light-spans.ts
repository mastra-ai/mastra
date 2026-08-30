import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import type { SearchableSpan } from '../types';
import { selectSearchableSpans } from '../utils';

const IMMUTABLE_CACHE_TIME = 1000 * 60 * 60 * 24 * 30; // 30 days, massive cache, span data is immutable

export function useTraceLightSpans(
  traceId: string | null | undefined,
): UseQueryResult<{ traceId: string; spans: SearchableSpan[] } | null> {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['trace-light-spans', traceId],
    queryFn: async () => {
      if (!traceId) {
        throw new Error('Trace ID is required');
      }
      const res = await client.getTraceLight(traceId);
      return res;
    },
    // Builds each span's search haystack once per fetch, cached with the query.
    select: selectSearchableSpans,
    enabled: !!traceId,
    staleTime: query => {
      const data = query.state.data;

      const isFinished = data?.spans.every(d => Boolean(d.endedAt));

      if (isFinished) {
        return IMMUTABLE_CACHE_TIME;
      }

      return 0;
    },
  });
}
