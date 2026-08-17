import type { ListMemoryThreadMessagesResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { skipToken, useInfiniteQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { usePlaygroundStore } from '@/store/playground-store';

const MESSAGE_PAGE_SIZE = 40;

const mergeMessagePages = (pages: ListMemoryThreadMessagesResponse[]) => {
  const newestMessageById = new Map<string, ListMemoryThreadMessagesResponse['messages'][number]>();
  const mergedMessages: ListMemoryThreadMessagesResponse['messages'] = [];

  for (let pageIndex = pages.length - 1; pageIndex >= 0; pageIndex--) {
    const page = pages[pageIndex];
    if (!page) continue;
    for (const message of page.messages) newestMessageById.set(message.id, message);
  }

  for (let pageIndex = pages.length - 1; pageIndex >= 0; pageIndex--) {
    const page = pages[pageIndex];
    if (!page) continue;
    for (const message of page.messages) {
      if (newestMessageById.get(message.id) === message) mergedMessages.push(message);
    }
  }

  return mergedMessages;
};

export interface UseAgentMessagesProps {
  threadId?: string;
  agentId: string;
  memory: boolean;
}
export const useAgentMessages = ({ threadId, agentId, memory }: UseAgentMessagesProps) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  const query = useInfiniteQuery({
    queryKey: ['memory', 'messages', threadId, agentId, requestContext],
    queryFn: threadId
      ? ({ pageParam }) =>
          client.getMemoryThread({ threadId, agentId }).listMessages({
            page: pageParam,
            perPage: MESSAGE_PAGE_SIZE,
            requestContext,
            includeSystemReminders: true,
          })
      : skipToken,
    initialPageParam: 0,
    getNextPageParam: lastPage => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    select: data => ({
      initialMessages: data.pages[0]?.messages ?? [],
      messages: mergeMessagePages(data.pages),
    }),
    enabled: memory && Boolean(threadId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const initialMessagesRef = useRef<{
    agentId: string;
    messages?: ListMemoryThreadMessagesResponse['messages'];
    requestContext: typeof requestContext;
    threadId?: string;
  }>({ agentId, requestContext, threadId });
  const queryChanged =
    initialMessagesRef.current.agentId !== agentId ||
    initialMessagesRef.current.requestContext !== requestContext ||
    initialMessagesRef.current.threadId !== threadId;

  if (queryChanged) initialMessagesRef.current = { agentId, requestContext, threadId };
  initialMessagesRef.current.messages ??= query.data?.initialMessages;

  return {
    ...query,
    data: query.data
      ? {
          ...query.data,
          initialMessages: initialMessagesRef.current.messages ?? [],
        }
      : undefined,
  };
};
