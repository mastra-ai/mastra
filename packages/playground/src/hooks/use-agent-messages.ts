import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { useMastraClient } from '@mastra/react';
import { skipToken, useInfiniteQuery } from '@tanstack/react-query';
import { usePlaygroundStore } from '@/store/playground-store';

export interface UseAgentMessagesProps {
  threadId?: string;
  agentId: string;
  memory: boolean;
}

const PER_PAGE = 40;

const NEWEST_PAGE = '';

const createdAtMs = (message: MastraDBMessage) => new Date(message.createdAt).getTime();

const byCreatedAt = (a: MastraDBMessage, b: MastraDBMessage) => createdAtMs(a) - createdAtMs(b);

export const useAgentMessages = ({ threadId, agentId, memory }: UseAgentMessagesProps) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useInfiniteQuery({
    queryKey: ['memory', 'messages', threadId, agentId, requestContext],
    initialPageParam: NEWEST_PAGE,
    queryFn:
      memory && threadId
        ? ({ pageParam: olderThan }) =>
            client.listThreadMessages(threadId, {
              agentId,
              requestContext,
              includeSystemReminders: true,
              perPage: PER_PAGE,
              orderBy: { field: 'createdAt', direction: 'DESC' },
              filter: olderThan ? { dateRange: { end: new Date(olderThan), endExclusive: true } } : undefined,
            })
        : skipToken,
    getNextPageParam: lastPage => {
      if (!lastPage.hasMore || lastPage.messages.length === 0) return undefined;
      return new Date(Math.min(...lastPage.messages.map(createdAtMs))).toISOString();
    },
    select: data => ({ ...data, messages: data.pages.flatMap(page => page.messages).sort(byCreatedAt) }),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
};
