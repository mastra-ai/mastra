import type { MastraClient } from '@mastra/client-js';
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { skipToken, useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData, QueryKey } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraInfiniteQueryOptions } from '../shared/query-options';

type AgentMessagesPage = Awaited<ReturnType<MastraClient['listThreadMessages']>>;

type AgentMessagesData = InfiniteData<AgentMessagesPage, string> & { messages: MastraDBMessage[] };

export interface UseAgentMessagesProps<TData = AgentMessagesData> {
  threadId?: string;
  agentId: string;
  memory: boolean;
  requestContext?: Record<string, any>;
  queryOptions?: MastraInfiniteQueryOptions<AgentMessagesPage, TData, QueryKey, string>;
}

const PER_PAGE = 40;

const NEWEST_PAGE = '';

const createdAtMs = (message: MastraDBMessage) => new Date(message.createdAt).getTime();

const byCreatedAt = (a: MastraDBMessage, b: MastraDBMessage) => createdAtMs(a) - createdAtMs(b);

export const useAgentMessages = <TData = AgentMessagesData>({
  threadId,
  agentId,
  memory,
  requestContext,
  queryOptions,
}: UseAgentMessagesProps<TData>) => {
  const client = useMastraClient();

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
              // Inclusive bound: messages sharing the oldest createdAt of the previous page
              // may have been cut off by perPage, so re-ask for them and dedupe by id below.
              filter: olderThan ? { dateRange: { end: new Date(olderThan) } } : undefined,
            })
        : skipToken,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (!lastPage.hasMore || lastPage.messages.length === 0) return undefined;
      const next = new Date(Math.min(...lastPage.messages.map(createdAtMs))).toISOString();
      // A full page of same-timestamp messages would re-request itself forever.
      return next === lastPageParam ? undefined : next;
    },
    select: (data): TData => {
      const seen = new Set<string>();
      const messages = data.pages
        .flatMap(page => page.messages)
        .filter(message => {
          if (seen.has(message.id)) return false;
          seen.add(message.id);
          return true;
        })
        .sort(byCreatedAt);
      return { ...data, messages } as AgentMessagesData as TData;
    },
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    ...queryOptions,
  });
};
