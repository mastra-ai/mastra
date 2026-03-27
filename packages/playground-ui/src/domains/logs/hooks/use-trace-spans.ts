import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

export function useTraceSpans(traceId: string | null | undefined) {
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
    enabled: !!traceId,
  });
}
