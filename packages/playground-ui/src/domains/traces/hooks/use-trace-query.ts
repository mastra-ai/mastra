import { MastraClient } from '@mastra/client-js';
import type { QueryTracesInput } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { keepPreviousData, skipToken, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useInView } from '@/hooks/use-in-view';

export const TRACE_QUERY_PER_PAGE = 25;

type TraceQueryResponse = Awaited<ReturnType<MastraClient['queryTraces']>>;
type TraceQueryTrace = TraceQueryResponse['traces'][number];

export type TraceQueryArgs = Omit<QueryTracesInput, 'page'>;

export interface UseTraceQueryArgs {
  query: TraceQueryArgs | undefined;
  limit?: number;
  enabled?: boolean;
  refetchInterval?: number | false;
  refetchOnWindowFocus?: boolean;
}

export interface UseTraceQueryReturn {
  data: TraceQueryTrace[] | undefined;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  isLoading: boolean;
  isFetching: boolean;
  isRefetching: boolean;
  fetchStatus: 'idle' | 'fetching' | 'paused';
  isError: boolean;
  error: Error | null;
  refetch: () => void;
  setEndOfListElement: (node: HTMLDivElement | null) => void;
}

export function getTraceQueryNextPageParam(lastPage: TraceQueryResponse | undefined): string | undefined {
  return lastPage?.page.next ?? undefined;
}

export function selectTraceQueryTraces(data: { pages: TraceQueryResponse[] }): TraceQueryTrace[] {
  const seen = new Set<string>();
  return data.pages.flatMap(page =>
    page.traces.filter(trace => {
      if (seen.has(trace.traceId)) return false;
      seen.add(trace.traceId);
      return true;
    }),
  );
}

/** Queries traces with cursor pagination and viewport-driven loading. */
export function useTraceQuery({
  query,
  limit = TRACE_QUERY_PER_PAGE,
  enabled = true,
  refetchInterval,
  refetchOnWindowFocus,
}: UseTraceQueryArgs): UseTraceQueryReturn {
  const client = useMastraClient();
  const { inView, setRef: setEndOfListElement } = useInView();
  const result = useInfiniteQuery<TraceQueryResponse, Error, TraceQueryTrace[], readonly unknown[], string | undefined>(
    {
      queryKey: ['trace-query', query, limit] as const,
      queryFn: query
        ? ({ pageParam }) => {
            // Capability failures must reach the fallback without the SDK retrying 501 responses.
            const queryClient = new MastraClient({ ...client.options, retries: 0 });
            return queryClient.queryTraces({ ...query, page: { limit, after: pageParam ?? null } });
          }
        : skipToken,
      initialPageParam: undefined,
      getNextPageParam: getTraceQueryNextPageParam,
      select: selectTraceQueryTraces,
      retry: false,
      placeholderData: keepPreviousData,
      refetchInterval,
      refetchOnWindowFocus,
      enabled,
    },
  );
  const {
    data,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isLoading,
    isFetching,
    isRefetching,
    fetchStatus,
    isError,
    error,
    refetch,
    isFetchNextPageError,
  } = result;

  useEffect(() => {
    if (enabled && inView && hasNextPage && !isFetching && !isFetchNextPageError) {
      void fetchNextPage();
    }
  }, [enabled, inView, hasNextPage, isFetching, isFetchNextPageError, fetchNextPage]);

  return {
    data,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isLoading,
    isFetching,
    isRefetching,
    fetchStatus,
    isError,
    error,
    refetch,
    setEndOfListElement,
  };
}
