import type { ListLogsArgs, ListLogsResponse } from '@mastra/core/storage';
import { useInView, generateMockLogs } from '@mastra/playground-ui';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { useEffect, useMemo } from 'react';

const MOCK_LOGS = generateMockLogs(200);

const LOGS_PER_PAGE = 50;

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

  const data = query.data?.length ? query.data : MOCK_LOGS;

  return { ...query, data, setEndOfListElement };
};
