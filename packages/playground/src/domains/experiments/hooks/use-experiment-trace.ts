import { selectSearchableSpans } from '@mastra/playground-ui/domains/traces/utils';
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
    // Builds each span's search haystack once per fetch, so the trace panel
    // rendered below an experiment result searches the same way as the traces page.
    select: selectSearchableSpans,
    enabled: !!traceId,
  });
};
