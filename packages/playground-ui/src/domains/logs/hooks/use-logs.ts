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

/** Deduplicates logs across loaded pages. Offset-based pagination duplicates rows at the page
 *  boundary whenever new logs are inserted between sequential `fetchNextPage` calls — without
 *  this filter the duplicates produce duplicate React keys and chaotic virtualizer offsets.
 *  Falls back to the full serialized record when `logId` is absent so logs that happen to
 *  share `(timestamp, message, data)` but differ in other fields aren't collapsed. */
function selectLogs(data: { pages: ListLogsResponse[] }) {
  const seen = new Set<string>();
  const result = [];
  for (const page of data.pages) {
    for (const log of page.logs ?? []) {
      const key = log.logId ?? JSON.stringify(log);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(log);
    }
  }
  return result;
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
    refetchInterval: 10000,
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    if (isEndOfListInView && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [isEndOfListInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return { ...query, data: query.data, setEndOfListElement };
};
