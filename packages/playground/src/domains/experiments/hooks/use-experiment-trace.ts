import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const useExperimentTrace = (traceId: string | null | undefined) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['experiment-trace-light', traceId],
    queryFn: async () => {
      if (!traceId) {
        throw new Error('Trace ID is required');
      }
      return client.getTraceLight(traceId);
    },
    enabled: !!traceId,
  });
};
