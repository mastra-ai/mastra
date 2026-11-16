import type { QueryTraceThreadsResult } from '@mastra/client-js';
import type { ThreadQueryRequest } from '@mastra/core/storage';
import { keepPreviousData, skipToken, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraInfiniteQueryOptions } from '../shared/query-options';
import { useInView } from '../shared/use-in-view';

export const THREAD_QUERY_PER_PAGE = 25;

export type ThreadQueryArgs = Omit<ThreadQueryRequest, 'page'>;
type ThreadQueryResult = QueryTraceThreadsResult<ThreadQueryRequest>;
export type ThreadRow = ThreadQueryResult['threads'][number];

export interface UseQueryThreadsArgs {
  query: ThreadQueryArgs | undefined;
  limit?: number;
  enabled?: boolean;
  queryOptions?: MastraInfiniteQueryOptions<ThreadQueryResult, ThreadRow[], readonly unknown[], string | undefined>;
}

export interface UseQueryThreadsReturn {
  threads: ThreadRow[] | undefined;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  /** Attach to the end-of-list sentinel; the next page loads when it scrolls into view. */
  setEndOfListElement: (node: HTMLDivElement | null) => void;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

const selectThreads = (data: { pages: ThreadQueryResult[] }): ThreadRow[] => data.pages.flatMap(page => page.threads);

/** Queries thread rows with cursor pagination and viewport-driven loading. */
export function useQueryThreads({
  query,
  limit = THREAD_QUERY_PER_PAGE,
  enabled = true,
  queryOptions,
}: UseQueryThreadsArgs): UseQueryThreadsReturn {
  const client = useMastraClient();
  const { inView, setRef: setEndOfListElement } = useInView();
  const {
    data,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    isFetchNextPageError,
  } = useInfiniteQuery<ThreadQueryResult, Error, ThreadRow[], readonly unknown[], string | undefined>({
    queryKey: ['thread-query', query, limit] as const,
    queryFn: query
      ? ({ pageParam }) =>
          client.queryTraceThreads({ ...query, page: pageParam ? { limit, after: pageParam } : { limit } })
      : skipToken,
    initialPageParam: undefined,
    getNextPageParam: lastPage => lastPage.page.next ?? undefined,
    select: selectThreads,
    retry: false,
    placeholderData: keepPreviousData,
    enabled,
    ...queryOptions,
  });

  useEffect(() => {
    if (enabled && inView && hasNextPage && !isFetching && !isFetchNextPageError) {
      void fetchNextPage();
    }
  }, [enabled, inView, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage]);

  return {
    threads: data,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage: () => void fetchNextPage(),
    setEndOfListElement,
    isLoading,
    isFetching,
    isError,
    error,
    refetch: () => void refetch(),
  };
}
