import type { UseQueryResult } from '@tanstack/react-query';
import type { MastraClient } from '@mastra/client-js';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

export const memoryThreadMessagesQueryKey = (threadId: string | undefined, page?: number) =>
  ['memory', 'thread', threadId, 'messages', page ?? 0] as const;

type MemoryThreadMessagesResponse = Awaited<ReturnType<ReturnType<MastraClient['getMemoryThread']>['listMessages']>>;

export function useMemoryThreadMessages<TData = MemoryThreadMessagesResponse>({
  threadId,
  page = 0,
  perPage = 100,
  queryOptions,
}: {
  threadId: string | undefined;
  page?: number;
  perPage?: number;
  queryOptions?: MastraQueryOptions<MemoryThreadMessagesResponse, TData>;
}): UseQueryResult<TData, Error> {
  const client = useMastraClient();

  return useQuery({
    queryKey: memoryThreadMessagesQueryKey(threadId, page),
    queryFn: threadId ? () => client.getMemoryThread({ threadId }).listMessages({ page, perPage }) : skipToken,
    ...queryOptions,
  });
}
