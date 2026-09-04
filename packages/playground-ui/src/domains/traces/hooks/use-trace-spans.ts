import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import type { SearchableSpan } from '../types';
import { selectSearchableSpans } from '../utils';

const IMMUTABLE_CACHE_TIME = 1000 * 60 * 60 * 24 * 30; // 30 days, massive cache, span data is immutable

/**
 * Every span of a single trace, with its full payload.
 *
 * The lightweight projection exists to keep blob columns off the read path of a
 * *list*, where the cost is paid once per trace on screen. A trace that is open
 * has already narrowed that to one, and the panel both renders and searches
 * these spans -- `input`, `output` and `attributes` included -- so the
 * projection would only hide content the reader is looking at.
 */
export function useTraceSpans(
  traceId: string | null | undefined,
): UseQueryResult<{ traceId: string; spans: SearchableSpan[] } | null> {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['trace-spans', traceId],
    queryFn: async () => {
      if (!traceId) {
        throw new Error('Trace ID is required');
      }
      const res = await client.getTrace(traceId);
      return res;
    },
    // Builds each span's search haystack once per fetch, cached with the query.
    select: selectSearchableSpans,
    enabled: !!traceId,
    staleTime: query => {
      const data = query.state.data;
      const isFinished = data?.spans.every(span => Boolean(span.endedAt));
      return isFinished ? IMMUTABLE_CACHE_TIME : 0;
    },
  });
}
