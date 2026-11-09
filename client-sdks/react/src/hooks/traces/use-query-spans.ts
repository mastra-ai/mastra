import type { QuerySpansInput, QuerySpansResult } from '@mastra/client-js';
import { keepPreviousData, skipToken, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraInfiniteQueryOptions } from '../shared/query-options';
import { useInView } from '../shared/use-in-view';

export const SPAN_QUERY_PER_PAGE = 25;

export type SpanQueryArgs = Omit<QuerySpansInput, 'page'>;
export type SpanRow = QuerySpansResult['spans'][number];

export interface UseQuerySpansArgs {
  query: SpanQueryArgs | undefined;
  limit?: number;
  enabled?: boolean;
  queryOptions?: MastraInfiniteQueryOptions<QuerySpansResult, SpanRow[], readonly unknown[], string | undefined>;
}

export interface UseQuerySpansReturn {
  spans: SpanRow[] | undefined;
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

const selectSpans = (data: { pages: QuerySpansResult[] }): SpanRow[] => data.pages.flatMap(page => page.spans);

/** Queries completed spans with cursor pagination and viewport-driven loading. */
export function useQuerySpans({
  query,
  limit = SPAN_QUERY_PER_PAGE,
  enabled = true,
  queryOptions,
}: UseQuerySpansArgs): UseQuerySpansReturn {
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
  } = useInfiniteQuery<QuerySpansResult, Error, SpanRow[], readonly unknown[], string | undefined>({
    queryKey: ['span-query', query, limit] as const,
    queryFn: query
      ? ({ pageParam }) => client.querySpans({ ...query, page: pageParam ? { limit, after: pageParam } : { limit } })
      : skipToken,
    initialPageParam: undefined,
    getNextPageParam: lastPage => lastPage.page.next ?? undefined,
    select: selectSpans,
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
    spans: data,
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
