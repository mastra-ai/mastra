import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

const IMMUTABLE_CACHE_TIME = 1000 * 60 * 60 * 24 * 30; // 30 days, massive cache, span data is immutable

export function useSpanDetail(traceId: string | null | undefined, spanId: string | null | undefined) {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['span-detail', traceId, spanId],
    queryFn: async () => {
      if (!traceId || !spanId) {
        throw new Error('Trace ID and Span ID are required');
      }
      return client.getSpan(traceId, spanId);
    },
    enabled: !!traceId && !!spanId,
    staleTime: query => {
      const data = query.state.data;

      if (data?.span?.endedAt) {
        return IMMUTABLE_CACHE_TIME;
      }

      return 0;
    },
  });
}
