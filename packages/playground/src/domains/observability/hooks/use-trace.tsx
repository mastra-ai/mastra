import { useQuery } from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';

export const useTrace = (traceId: string | null | undefined, options?: { enabled: boolean }) => {
  const client = useMastraClient();
  const query = useQuery({
    queryKey: ['trace', traceId],
    queryFn: async () => {
      if (!traceId) {
        throw new Error('Trace ID is required');
      }

      const res = await client.getTrace(traceId);
      return res;
    },
    enabled: !!traceId,
    refetchInterval: 3000,
    ...options,
  });

  return query;
};
