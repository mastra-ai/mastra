import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

const IMMUTABLE_CACHE_TIME = 1000 * 60 * 60 * 24 * 30; // 30 days, massive cache, span data is immutable

export function useTraceLightSpans(traceId: string | null | undefined) {
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
