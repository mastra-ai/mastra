import { useMastraClient } from '@mastra/react';
import { useInView, useInfiniteQuery } from '@mastra/playground-ui';
import { useEffect } from 'react';
import type { ListAuditLogsParams, AuditEvent } from '@mastra/client-js';

const fetchAuditLogsFn = async ({
  client,
  page,
  perPage,
  filters,
}: AuditLogsFilters & {
  client: ReturnType<typeof useMastraClient>;
  page: number;
  perPage: number;
}) => {
  const res = await client.listAuditLogs({
    page,
    perPage,
    ...filters,
  });

  return res.events || [];
};

export interface AuditLogsFilters {
  filters?: Omit<ListAuditLogsParams, 'page' | 'perPage'>;
}

export const useAuditLogs = ({ filters }: AuditLogsFilters = {}) => {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    queryKey: ['auditLogs', filters],
    queryFn: ({ pageParam }) =>
      fetchAuditLogsFn({
        client,
        page: pageParam,
        perPage: 25,
        filters,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _, lastPageParam) => {
      if (!lastPage?.length) {
        return undefined;
      }
      return lastPageParam + 1;
    },
    staleTime: 0,
    gcTime: 0,
    select: data => {
      return data.pages.flatMap(page => page) as AuditEvent[];
    },
    retry: false,
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (isEndOfListInView && query.hasNextPage && !query.isFetchingNextPage) {
      query.fetchNextPage();
    }
  }, [isEndOfListInView, query.hasNextPage, query.isFetchingNextPage]);

  return { ...query, setEndOfListElement };
};
