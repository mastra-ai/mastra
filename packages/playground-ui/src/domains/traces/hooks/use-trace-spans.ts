import type { LightSpanRecord } from '@mastra/core/storage';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

export function useTraceSpans(
  traceId: string | null | undefined,
): UseQueryResult<{ traceId: string; spans: LightSpanRecord[] } | null> {
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
