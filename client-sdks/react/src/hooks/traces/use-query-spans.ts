import type { QuerySpansInput, QuerySpansResult } from '@mastra/client-js';
import { keepPreviousData, skipToken, useInfiniteQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraInfiniteQueryOptions } from '../shared/query-options';
import { useInView } from '../shared/use-in-view';
import { useProgressiveList } from '../shared/use-progressive-list';
import type { ProgressiveListState } from '../shared/use-progressive-list';

export const SPAN_QUERY_PER_PAGE = 25;

/**
 * Set `progressive: true` with a word search when the server reports `progressiveTokenSearch`: each page
 * then searches one chunk of the range, newest first, and the list pages by `continuation`.
 */
export type SpanQueryArgs = Omit<QuerySpansInput, 'page' | 'continuation'>;
export type SpanRow = QuerySpansResult['spans'][number];

export interface UseQuerySpansArgs {
  query: SpanQueryArgs | undefined;
  limit?: number;
  enabled?: boolean;
  queryOptions?: MastraInfiniteQueryOptions<QuerySpansResult, SpanRow[], readonly unknown[], string | undefined>;
}

export interface UseQuerySpansReturn extends ProgressiveListState {
  spans: SpanRow[] | undefined;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  /** Attach to the end-of-list sentinel; the next page loads when it scrolls into view. */
  setEndOfListElement: (node: HTMLDivElement | null) => void;
  isLoading: boolean;
  isFetching: boolean;
  /** The list could not load. For a progressive search, a failed later chunk is `chunkError` instead. */
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
  const progressive = query?.progressive === true;
  const queryKey = ['span-query', query, limit] as const;
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
    queryKey,
    queryFn: query
      ? ({ pageParam, signal }) =>
          client.querySpans(
            progressive
              ? { ...query, page: { limit }, ...(pageParam ? { continuation: pageParam } : {}) }
              : { ...query, page: pageParam ? { limit, after: pageParam } : { limit } },
            { signal },
          )
      : skipToken,
    initialPageParam: undefined,
    // A progressive search pages by `continuation`, present only in its responses.
    getNextPageParam: lastPage =>
      (lastPage.continuation !== undefined ? lastPage.continuation : lastPage.page.next) ?? undefined,
    select: selectSpans,
    retry: false,
    placeholderData: keepPreviousData,
    enabled,
    ...queryOptions,
  });

  const progressiveList = useProgressiveList({
    queryKey,
    progressive,
    enabled,
    inView,
    hasNextPage,
    isFetching,
    isFetchNextPageError,
    fetchNextPage,
    error,
  });

  return {
    ...progressiveList,
    spans: data,
    hasNextPage,
    isFetchingNextPage,
    setEndOfListElement,
    isLoading,
    isFetching,
    isError: progressive ? isError && !isFetchNextPageError : isError,
    // A failed later chunk is `chunkError`; the rows before it are still the list.
    error: progressive && isFetchNextPageError ? null : error,
    refetch: () => void refetch(),
  };
}
