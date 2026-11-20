import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

export const memoryThreadMessagesQueryKey = (threadId: string | undefined, page?: number, agentId?: string) =>
  ['memory', 'thread', threadId, 'messages', page ?? 0, agentId] as const;

type MemoryThreadMessagesResponse = Awaited<ReturnType<ReturnType<MastraClient['getMemoryThread']>['listMessages']>>;

export function useMemoryThreadMessages<TData = MemoryThreadMessagesResponse>({
  threadId,
  agentId,
  page = 0,
  perPage = 100,
  queryOptions,
}: {
  threadId: string | undefined;
  /** Reads through this agent's memory instead of the server's global storage. */
  agentId?: string;
  page?: number;
  perPage?: number;
  queryOptions?: MastraQueryOptions<MemoryThreadMessagesResponse, TData>;
}): UseQueryResult<TData, Error> {
  const client = useMastraClient();

  return useQuery({
    queryKey: memoryThreadMessagesQueryKey(threadId, page, agentId),
    queryFn: threadId ? () => client.getMemoryThread({ threadId, agentId }).listMessages({ page, perPage }) : skipToken,
    ...queryOptions,
  });
}
