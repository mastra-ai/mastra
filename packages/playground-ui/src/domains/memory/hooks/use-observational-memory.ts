import { useMastraClient } from '@mastra/react';
import { skipToken, useQuery } from '@tanstack/react-query';

export const observationalMemoryQueryKey = (agentId: string | undefined, threadId: string | undefined) =>
  ['memory', 'observational-memory', agentId, threadId] as const;

export function useObservationalMemory(agentId: string | undefined, threadId: string | undefined, resourceId?: string) {
  const client = useMastraClient();

  return useQuery({
    queryKey: observationalMemoryQueryKey(agentId, threadId),
    queryFn:
      agentId && threadId
        ? () =>
            client.getObservationalMemory({
              agentId,
              threadId,
              resourceId,
            })
        : skipToken,
    // The record is read by several surfaces at once (collapsed memory bar, OM
    // section, detail panel). A short stale window lets a newly mounted consumer
    // reuse the cached record instead of refiring the request; freshness still
    // comes from the explicit refetch on stream finish/observation signals.
    staleTime: 5_000,
  });
}
