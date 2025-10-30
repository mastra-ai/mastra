import { useQuery } from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';

export const useAITrace = (traceId: string | null | undefined, options?: { enabled: boolean }) => {
  const client = useMastraClient();
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
    refetchInterval: 3000,
    ...options,
  });

  return query;
};
