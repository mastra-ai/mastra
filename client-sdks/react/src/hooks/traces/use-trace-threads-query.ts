import type { QueryTraceThreadsInput, QueryTraceThreadsResult } from '@mastra/client-js';
import { keepPreviousData, skipToken, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { useMastraClient } from '../../mastra-client-context';
import { useInView } from '../shared/use-in-view';

export const TRACE_THREADS_PER_PAGE = 50;

export type TraceThreadsSelection = QueryTraceThreadsInput['traces'];

export interface UseTraceThreadsQueryArgs {
  /** Eligible traces: a thread is listed when at least one of its traces matches. */
  selection: TraceThreadsSelection | undefined;
  limit?: number;
  enabled?: boolean;
}

/** Lists thread ids from the thread-query API with cursor pagination and viewport-driven loading. */
export function useTraceThreadsQuery({
  selection,
  limit = TRACE_THREADS_PER_PAGE,
  enabled = true,
}: UseTraceThreadsQueryArgs) {
  const client = useMastraClient();
  const { inView, setRef: setEndOfListElement } = useInView();
  const result = useInfiniteQuery<
    QueryTraceThreadsResult,
    Error,
    QueryTraceThreadsResult[],
    readonly unknown[],
    string | undefined
  >({
    queryKey: ['trace-threads-query', selection, limit] as const,
    queryFn: selection
      ? ({ pageParam }) => client.queryTraceThreads({ traces: selection, page: { limit, after: pageParam ?? null } })
      : skipToken,
    initialPageParam: undefined,
    getNextPageParam: lastPage => lastPage?.page.next ?? undefined,
    select: data => data.pages,
    retry: false,
    placeholderData: keepPreviousData,
    enabled,
  });

  const threadIds = useMemo(() => {
    const seen = new Set<string>();
    for (const page of result.data ?? []) for (const thread of page.threads) seen.add(thread.threadId);
    return [...seen];
  }, [result.data]);

  const { hasNextPage, isFetching, isFetchNextPageError, fetchNextPage } = result;
  useEffect(() => {
    if (enabled && inView && hasNextPage && !isFetching && !isFetchNextPageError) void fetchNextPage();
  }, [enabled, inView, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage]);

  return {
    threadIds,
    isLoading: result.isLoading,
    isFetchingNextPage: result.isFetchingNextPage,
    hasNextPage: result.hasNextPage,
    error: result.error,
    setEndOfListElement,
  };
}
