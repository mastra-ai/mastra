import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

export type UseTraceOptions = {
  enabled?: boolean;
  refetchInterval?: number | false;
};

export const useTrace = (traceId: string | null | undefined, options?: UseTraceOptions) => {
  const client = useMastraClient();
  const { enabled = true, refetchInterval = false } = options ?? {};

  return useQuery({
    queryKey: ['trace', traceId],
    queryFn: async () => {
      if (!traceId) {
        throw new Error('Trace ID is required');
      }
      return client.getTrace(traceId);
    },
    enabled: !!traceId && enabled,
    refetchInterval,
  });
};
