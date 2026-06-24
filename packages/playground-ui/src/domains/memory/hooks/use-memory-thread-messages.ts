import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

export const memoryThreadMessagesQueryKey = (threadId: string, page?: number) =>
  ['memory', 'thread', threadId, 'messages', page ?? 0] as const;

export function useMemoryThreadMessages(threadId: string | undefined, opts?: { page?: number; perPage?: number }) {
  const client = useMastraClient();
  const page = opts?.page ?? 0;
  const perPage = opts?.perPage ?? 100;

  return useQuery({
    queryKey: memoryThreadMessagesQueryKey(threadId!, page),
    queryFn: () => client.getMemoryThread({ threadId: threadId! }).listMessages({ page, perPage }),
    enabled: !!threadId,
  });
}
