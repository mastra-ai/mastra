import type { TraceQueryRequest, TraceQueryTrace, TraceQueryTraceResponse } from '@mastra/core/storage';
import { useMastraClient } from '@mastra/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useInView } from '@/hooks/use-in-view';

export const TRACE_QUERY_PER_PAGE = 25;

export type TraceQueryArgs = Omit<TraceQueryRequest, 'group' | 'page'>;

export interface UseTraceQueryArgs {
  query: TraceQueryArgs;
  limit?: number;
  enabled?: boolean;
}

export interface UseTraceQueryReturn {
  data: TraceQueryTrace[] | undefined;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  isLoading: boolean;
  isFetching: boolean;
  fetchStatus: 'idle' | 'fetching' | 'paused';
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  setEndOfListElement: (node: HTMLDivElement | null) => void;
}

export function getTraceQueryNextPageParam(lastPage: TraceQueryTraceResponse | undefined): string | undefined {
  return lastPage?.page.next ?? undefined;
}

export function selectTraceQueryTraces(data: { pages: TraceQueryTraceResponse[] }): TraceQueryTrace[] {
  const seen = new Set<string>();
  return data.pages.flatMap(page =>
    page.traces.filter(trace => {
      if (seen.has(trace.traceId)) return false;
      seen.add(trace.traceId);
      return true;
    }),
  );
}

/** Queries traces with cursor pagination and viewport-driven loading, without polling. */
export function useTraceQuery({
  query,
  limit = TRACE_QUERY_PER_PAGE,
  enabled = true,
}: UseTraceQueryArgs): UseTraceQueryReturn {
  const client = useMastraClient();
  const { inView, setRef: setEndOfListElement } = useInView();
  const result = useInfiniteQuery<
    TraceQueryTraceResponse,
    Error,
    TraceQueryTrace[],
    readonly unknown[],
    string | undefined
  >({
    queryKey: ['trace-query', query, limit] as const,
    queryFn: ({ pageParam }) => client.queryTraces({ ...query, page: { limit, after: pageParam ?? null } }),
    initialPageParam: undefined,
    getNextPageParam: getTraceQueryNextPageParam,
    select: selectTraceQueryTraces,
    retry: false,
    enabled,
  });
  const {
    data,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isLoading,
    isFetching,
    fetchStatus,
    isError,
    error,
    refetch,
  } = result;

  useEffect(() => {
    if (enabled && inView && hasNextPage && !isFetching) {
      void fetchNextPage();
    }
  }, [enabled, inView, hasNextPage, isFetching, fetchNextPage]);

  return {
    data,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isLoading,
    isFetching,
    fetchStatus,
    isError,
    error,
    refetch,
    setEndOfListElement,
  };
}
