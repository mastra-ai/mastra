import { useMastraClient } from '@mastra/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { usePlaygroundStore } from '@/store/playground-store';

export interface UseAgentMessagesProps {
  threadId?: string;
  agentId: string;
  memory: boolean;
}

/** Number of messages fetched per page. Matches the server's default for the endpoint. */
const PER_PAGE = 40;

export const useAgentMessages = ({ threadId, agentId, memory }: UseAgentMessagesProps) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useInfiniteQuery({
    queryKey: ['memory', 'messages', threadId, agentId, 'requestContext'],
    queryFn: async ({ pageParam }) => {
      if (!threadId) return null;
      return client.listThreadMessages(threadId, {
        agentId,
        requestContext,
        includeSystemReminders: true,
        // Page 0 = newest PER_PAGE messages (DESC).
        page: pageParam,
        perPage: PER_PAGE,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });
    },
    initialPageParam: 0,
    getPreviousPageParam: (firstPage, _allPages, firstPageParam) => {
      if (!firstPage?.hasMore) return undefined;
      return (firstPageParam as number) + 1;
    },
    getNextPageParam: () => undefined,
    enabled: memory && Boolean(threadId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    select: data => {
      const seen = new Set<string>();
      const allMessages = data.pages
        .flatMap(page => page?.messages ?? [])
        .filter(msg => {
          if (seen.has(msg.id)) return false;
          seen.add(msg.id);
          return true;
        })
        .reverse();
      return { ...data, messages: allMessages };
    },
  });
};
