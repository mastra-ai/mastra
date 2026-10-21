import type { QuerySpansInput, QuerySpansResult } from '@mastra/client-js';
import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';

export const SPAN_QUERY_PER_PAGE = 25;

export type SpanQueryArgs = Omit<QuerySpansInput, 'page'>;
export type SpanRow = QuerySpansResult['spans'][number];

export interface UseQuerySpansArgs {
  query: SpanQueryArgs | undefined;
  limit?: number;
  /** Cursor of the page to load (`page.next` of the previous page). Omit for the first page. */
  after?: string;
  enabled?: boolean;
  queryOptions?: MastraQueryOptions<QuerySpansResult>;
}

export interface UseQuerySpansReturn {
  spans: SpanRow[] | undefined;
  /** Cursor of the page after the current one; `null` on the last page. */
  nextCursor: string | null;
  isLoading: boolean;
  isFetching: boolean;
  /** The rows belong to the previous page while the requested one loads. */
  isPlaceholderData: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/** Queries one page of completed spans for the given cursor. */
export function useQuerySpans({
  query,
  limit = SPAN_QUERY_PER_PAGE,
  after,
  enabled = true,
  queryOptions,
}: UseQuerySpansArgs): UseQuerySpansReturn {
  const client = useMastraClient();
  const { data, isLoading, isFetching, isPlaceholderData, isError, error, refetch } = useQuery<QuerySpansResult>({
    queryKey: ['span-query', query, limit, after ?? null],
    queryFn: query ? () => client.querySpans({ ...query, page: after ? { limit, after } : { limit } }) : skipToken,
    retry: false,
    placeholderData: keepPreviousData,
    enabled,
    ...queryOptions,
  });

  return {
    spans: data?.spans,
    nextCursor: data?.page.next ?? null,
    isLoading,
    isFetching,
    isPlaceholderData,
    isError,
    error,
    refetch: () => void refetch(),
  };
}
