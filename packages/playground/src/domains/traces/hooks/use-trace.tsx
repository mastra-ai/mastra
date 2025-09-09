import { useQuery } from '@mastra/playground-ui';
import { client } from '@/lib/client';

export const useTrace = (traceId: string | null | undefined, options?: { enabled?: boolean }) => {
  const query = useQuery({
    queryKey: ['trace', traceId],
    queryFn: async () => {
      if (!traceId) {
        throw new Error('Trace ID is required');
      }

      const res = await client.getTrace(traceId);
      return res;
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!traceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });

  return query;
};
