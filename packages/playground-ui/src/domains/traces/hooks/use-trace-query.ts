import { MastraClient } from '@mastra/client-js';
import type { QueryTracesKeysetInput, TraceQueryKeysetTraceResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { keepPreviousData, skipToken, useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { buildTraceListFilters } from '../trace-filters';
import { useInView } from '@/hooks/use-in-view';

export const TRACE_QUERY_PER_PAGE = 25;

type TraceQueryTrace = TraceQueryKeysetTraceResponse['traces'][number];

type ListTracesArgs = NonNullable<Parameters<MastraClient['listTracesLight']>[0]>;
type LegacyTraceListFilters = ReturnType<typeof buildTraceListFilters>;
type ListTracesLightResponse = Awaited<ReturnType<MastraClient['listTracesLight']>>;
type LightSpanRecord = ListTracesLightResponse['spans'][number];

export type TraceQueryArgs = Omit<QueryTracesKeysetInput, 'page' | 'pagination'>;

export interface UseTraceQueryArgs {
  query: TraceQueryArgs | undefined;
  limit?: number;
  enabled?: boolean;
  refetchInterval?: number | false;
  refetchOnWindowFocus?: boolean;
  /** When false, lists traces through the legacy `listTracesLight` endpoint instead of the trace-query API. */
  withQueryTrace?: boolean;
  /** Filters for the legacy endpoint, as built by `buildTraceListFilters`. Only read when `withQueryTrace` is false. */
  legacyFilters?: LegacyTraceListFilters;
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

export function getTraceQueryNextPageParam(lastPage: TraceQueryKeysetTraceResponse | undefined): string | undefined {
  return lastPage?.page.next ?? undefined;
}

export function selectTraceQueryTraces(data: { pages: TraceQueryKeysetTraceResponse[] }): TraceQueryTrace[] {
  const seen = new Set<string>();
  return data.pages.flatMap(page =>
    page.traces.filter(trace => {
      if (seen.has(trace.traceId)) return false;
      seen.add(trace.traceId);
      return true;
    }),
  );
}

const toIsoString = (value: Date | string): string => (typeof value === 'string' ? value : value.toISOString());

/** Maps a legacy light root span to a trace-query row. The light record carries no
 *  thread/resource/environment, so those stay null. Running spans have no `endedAt` and may carry a
 *  status outside the query API's enum; both are kept as-is (the list view handles them), hence the
 *  assertion at this compatibility boundary. */
export function lightSpanToTraceQueryTrace(span: LightSpanRecord): TraceQueryTrace {
  const row = {
    traceId: span.traceId,
    rootSpanId: span.spanId,
    name: span.name,
    entityId: span.entityId ?? null,
    parentSpanId: span.parentSpanId ?? null,
    createdAt: toIsoString(span.createdAt),
    metadata: span.metadata ?? null,
    inputPreview: span.inputPreview ?? null,
    threadId: null,
    resourceId: null,
    startedAt: toIsoString(span.startedAt),
    endedAt: span.endedAt == null ? span.endedAt : toIsoString(span.endedAt),
    entityName: span.entityName ?? null,
    entityType: span.entityType ?? null,
    environment: null,
    status: span.status,
  };
  return row as TraceQueryTrace;
}

export function selectLegacyTraceQueryTraces(data: { pages: ListTracesLightResponse[] }): TraceQueryTrace[] {
  const seen = new Set<string>();
  return data.pages.flatMap(page =>
    page.spans.flatMap(span => {
      if (seen.has(span.traceId)) return [];
      seen.add(span.traceId);
      return [lightSpanToTraceQueryTrace(span)];
    }),
  );
}

export function getLegacyTraceQueryNextPageParam(lastPage: ListTracesLightResponse): number | undefined {
  return lastPage.pagination?.hasMore ? lastPage.pagination.page + 1 : undefined;
}

/** Queries traces with cursor pagination and viewport-driven loading. */
export function useTraceQuery({
  query,
  limit = TRACE_QUERY_PER_PAGE,
  enabled = true,
  refetchInterval,
  refetchOnWindowFocus,
  withQueryTrace = true,
  legacyFilters,
}: UseTraceQueryArgs): UseTraceQueryReturn {
  const client = useMastraClient();
  const { inView, setRef: setEndOfListElement } = useInView();
  const queryResult = useInfiniteQuery<
    TraceQueryKeysetTraceResponse,
    Error,
    TraceQueryTrace[],
    readonly unknown[],
    string | undefined
  >({
    queryKey: ['trace-query', query, limit] as const,
    queryFn: query
      ? async ({ pageParam }) => {
          // Capability failures must reach the fallback without the SDK retrying 501 responses.
          const queryClient = new MastraClient({ ...client.options, retries: 0 });
          const response = await queryClient.queryTraces({ ...query, page: { limit, after: pageParam ?? null } });
          if ('traces' in response && 'page' in response) return response;
          throw new Error('Expected a cursor-paginated trace query response');
        }
      : skipToken,
    initialPageParam: undefined,
    getNextPageParam: getTraceQueryNextPageParam,
    select: selectTraceQueryTraces,
    retry: false,
    placeholderData: keepPreviousData,
    refetchInterval,
    refetchOnWindowFocus,
    enabled: enabled && withQueryTrace,
  });
  const orderBy = query?.orderBy;
  const legacyDirection = orderBy?.[0]?.direction === 'asc' ? 'ASC' : 'DESC';
  const legacyResult = useInfiniteQuery<ListTracesLightResponse, Error, TraceQueryTrace[], readonly unknown[], number>({
    queryKey: ['trace-query-legacy', legacyFilters, limit, orderBy] as const,
    queryFn: ({ pageParam }) =>
      client.listTracesLight({
        // Core's date-range filter types `start`/`end` loosely; the client param type is stricter.
        filters: legacyFilters as ListTracesArgs['filters'],
        pagination: { page: pageParam, perPage: limit },
        orderBy: { field: 'startedAt', direction: legacyDirection },
      }),
    initialPageParam: 0,
    getNextPageParam: getLegacyTraceQueryNextPageParam,
    select: selectLegacyTraceQueryTraces,
    retry: false,
    placeholderData: keepPreviousData,
    refetchInterval,
    refetchOnWindowFocus,
    enabled: enabled && !withQueryTrace,
  });
  const result = withQueryTrace ? queryResult : legacyResult;
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
