import { useQuery } from '@mastra/playground-ui';
import { client } from '@/lib/client';

export const useAITrace = (traceId: string | null | undefined) => {
  const query = useQuery({
    queryKey: ['ai-trace', traceId],
    queryFn: async () => {
      if (!traceId) {
        throw new Error('Trace ID is required');
      }

      const res = await client.getAITrace(traceId);
      return res;
    },
    enabled: !!traceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return query;
};
