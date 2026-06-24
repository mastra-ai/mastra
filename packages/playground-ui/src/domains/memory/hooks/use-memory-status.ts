import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const memoryStatusQueryKey = (agentId: string, threadId?: string) =>
  ['memory', 'status', agentId, threadId ?? ''] as const;

export function useMemoryStatus(agentId: string | undefined, threadId?: string) {
  const client = useMastraClient();

  return useQuery({
    queryKey: memoryStatusQueryKey(agentId!, threadId),
    queryFn: () =>
      client.getMemoryStatus(agentId!, undefined, {
        threadId,
      }),
    enabled: !!agentId,
  });
}
