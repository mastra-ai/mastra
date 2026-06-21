import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const memoryThreadQueryKey = (threadId: string) => ['memory', 'thread', threadId] as const;

export function useMemoryThread(threadId: string | undefined) {
  const client = useMastraClient();

  return useQuery({
    queryKey: memoryThreadQueryKey(threadId!),
    queryFn: () => client.getMemoryThread({ threadId: threadId! }).get(),
    enabled: !!threadId,
  });
}
