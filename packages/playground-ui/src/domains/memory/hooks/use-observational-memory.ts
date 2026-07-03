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
  });
}
