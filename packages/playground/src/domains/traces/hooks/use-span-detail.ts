import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export function useSpanDetail(traceId: string | null | undefined, spanId: string | null | undefined) {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['span-detail', traceId, spanId],
    queryFn: async () => {
      if (!traceId || !spanId) {
        throw new Error('Trace ID and Span ID are required');
      }
      const res = await client.getSpan(traceId, spanId);
      return res;
    },
    enabled: !!traceId && !!spanId,
  });
}
