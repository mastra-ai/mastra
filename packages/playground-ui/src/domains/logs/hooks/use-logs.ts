import type { ListLogsArgs, ListLogsResponse } from '@mastra/core/storage';
import { useMastraClient } from '@mastra/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useInView } from '@/hooks/use-in-view';

const LOGS_PER_PAGE = 20;

export interface LogsFilters {
  filters?: ListLogsArgs['filters'];
}

function getNextPageParam(lastPage: ListLogsResponse | undefined, _allPages: unknown, lastPageParam: number) {
  if (lastPage?.pagination?.hasMore) {
    return lastPageParam + 1;
  }
  return undefined;
}

function selectLogs(data: { pages: ListLogsResponse[] }) {
  return data.pages.flatMap(page => page.logs ?? []);
}

export const useLogs = ({ filters }: LogsFilters = {}) => {
  const client = useMastraClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const query = useInfiniteQuery({
    queryKey: ['logs', filters],
    queryFn: ({ pageParam }) =>
      client.listLogsVNext({
        pagination: { page: pageParam, perPage: LOGS_PER_PAGE },
        filters,
        orderBy: { field: 'timestamp', direction: 'DESC' },
      }),
    initialPageParam: 0,
    getNextPageParam,
    select: selectLogs,
    retry: false,
    refetchInterval: 3000,
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    if (isEndOfListInView && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [isEndOfListInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return { ...query, data: query.data, setEndOfListElement };
};
