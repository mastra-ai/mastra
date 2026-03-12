import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

export const useExperimentTrace = (traceId: string | null | undefined) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['experiment-trace', traceId],
    queryFn: async () => {
      if (!traceId) {
        throw new Error('Trace ID is required');
      }
      return client.getTrace(traceId);
    },
    enabled: !!traceId,
  });
};
