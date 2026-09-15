import { useMastraClient } from '@mastra/react';
import { skipToken, useQuery } from '@tanstack/react-query';

export const memoryStatusQueryKey = (agentId: string | undefined, threadId?: string) =>
  ['memory', 'status', agentId, threadId] as const;

export function useMemoryStatus(agentId: string | undefined, threadId?: string) {
  const client = useMastraClient();

  return useQuery({
    queryKey: memoryStatusQueryKey(agentId, threadId),
    queryFn: agentId
      ? () =>
          client.getMemoryStatus(agentId, undefined, {
            threadId,
          })
      : skipToken,
  });
}
