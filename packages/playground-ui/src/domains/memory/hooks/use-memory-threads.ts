import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const memoryThreadsQueryKey = (agentId?: string) => ['memory', 'threads', agentId ?? 'all'] as const;

export function useMemoryThreads(agentId?: string) {
  const client = useMastraClient();

  return useQuery({
    queryKey: memoryThreadsQueryKey(agentId),
    queryFn: () => client.listMemoryThreads({ agentId }),
  });
}
