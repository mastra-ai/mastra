import { MastraClient, MastraClientError } from '@mastra/client-js';
import type { QueryTracesKeysetInput, TraceQueryKeysetTraceResponse } from '@mastra/client-js';
import type { ListTracesArgs as StorageListTracesArgs } from '@mastra/core/storage';
import { keepPreviousData, skipToken, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraInfiniteQueryOptions, MastraQueryOptions } from '../shared/query-options';
import { useInView } from '../shared/use-in-view';

export const TRACE_QUERY_PER_PAGE = 25;
/** Max traces per delta request; the server caps `limit` at 100. */
export const TRACE_QUERY_DELTA_LIMIT = 100;

type TraceQueryTrace = TraceQueryKeysetTraceResponse['traces'][number];

type ListTracesArgs = NonNullable<Parameters<MastraClient['listTracesLight']>[0]>;
type LegacyTraceListFilters = StorageListTracesArgs['filters'];
type ListTracesLightResponse = Awaited<ReturnType<MastraClient['listTracesLight']>>;
type LightSpanRecord = ListTracesLightResponse['spans'][number];

export type TraceQueryArgs = Omit<QueryTracesKeysetInput, 'page' | 'pagination'>;

export interface UseTraceQueryArgs {
  query: TraceQueryArgs | undefined;
  limit?: number;
  enabled?: boolean;
  /** When false, lists traces through the legacy `listTracesLight` endpoint instead of the trace-query API. */
  withQueryTrace?: boolean;
  /** Filters for the legacy endpoint, as built by `buildTraceListFilters`. Only read when `withQueryTrace` is false. */
  legacyFilters?: LegacyTraceListFilters;
  /** TanStack options spread last into the trace-query (`traceQuery`) and legacy (`legacy`) infinite queries. */
  queryOptions?: {
    traceQuery?: MastraInfiniteQueryOptions<
      TraceQueryKeysetTraceResponse,
      TraceQueryTrace[],
      readonly unknown[],
      string | undefined
    >;
    legacy?: MastraInfiniteQueryOptions<ListTracesLightResponse, TraceQueryTrace[], readonly unknown[], number>;
  };
}

export interface UseTraceQueryReturn {
  data: TraceQueryTrace[] | undefined;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  isLoading: boolean;
  /** The rows belong to the previous query key (e.g. another thread) while the new one loads. */
  isPlaceholderData: boolean;
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
 *  environment, so it stays null. Running spans have no `endedAt` and may carry a
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
    outputPreview: span.outputPreview ?? null,
    errorPreview: span.errorPreview ?? null,
    threadId: span.threadId ?? null,
    resourceId: span.resourceId ?? null,
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

/** Cache key of `useTraceQuery`'s trace-query list. Pass the same `query` and `limit` to share it. */
export const traceQueryKey = (query: TraceQueryArgs | undefined, limit: number = TRACE_QUERY_PER_PAGE) =>
  ['trace-query', query, limit] as const;

type TraceQueryOrderBy = NonNullable<TraceQueryArgs['orderBy']>[number];

function traceSortValue(trace: TraceQueryTrace, field: TraceQueryOrderBy['field']): number | null {
  if (field === 'timeToFirstChunkMs') return trace.timeToFirstChunkMs ?? null;
  const value = trace[field];
  return value == null ? null : Date.parse(value);
}

/** Mirrors the server's keyset order: empty values last in both directions, ties by ascending `traceId`. */
function compareTraces(orderBy: TraceQueryOrderBy) {
  return (a: TraceQueryTrace, b: TraceQueryTrace): number => {
    const va = traceSortValue(a, orderBy.field);
    const vb = traceSortValue(b, orderBy.field);
    if (va !== vb) {
      if (va === null) return 1;
      if (vb === null) return -1;
      return orderBy.direction === 'asc' ? va - vb : vb - va;
    }
    return a.traceId < b.traceId ? -1 : a.traceId > b.traceId ? 1 : 0;
  };
}

/**
 * Merges delta-polled traces into the pages of a `useTraceQuery` list, without mutating `data`.
 * A trace already on a page is replaced in place (its status or `endedAt` may have changed). A new
 * trace goes into the first page whose last row sorts after it; when no loaded page does, it is
 * appended to the last page if that is the end of the list, and skipped otherwise, since keyset
 * pagination returns it once the user scrolls there. Page cursors are kept as they are, and `data`
 * itself is returned when nothing changed.
 */
export function mergeTraceQueryDelta(
  data: InfiniteData<TraceQueryKeysetTraceResponse>,
  traces: TraceQueryTrace[],
  orderBy?: TraceQueryArgs['orderBy'],
): InfiniteData<TraceQueryKeysetTraceResponse> {
  if (traces.length === 0 || data.pages.length === 0) return data;

  const incoming = new Map(traces.map(trace => [trace.traceId, trace]));
  const rows = data.pages.map(page => page.traces);
  const changed = new Set<number>();
  const write = (pageIndex: number, next: TraceQueryTrace[]) => {
    rows[pageIndex] = next;
    changed.add(pageIndex);
  };

  rows.forEach((pageRows, pageIndex) => {
    if (!pageRows.some(row => incoming.has(row.traceId))) return;
    write(
      pageIndex,
      pageRows.map(row => incoming.get(row.traceId) ?? row),
    );
  });
  for (const pageRows of rows) for (const row of pageRows) incoming.delete(row.traceId);

  const compare = compareTraces(orderBy?.[0] ?? { field: 'startedAt', direction: 'desc' });
  const lastIndex = rows.length - 1;
  for (const trace of incoming.values()) {
    let pageIndex = rows.findIndex(pageRows => {
      const last = pageRows[pageRows.length - 1];
      return last !== undefined && compare(trace, last) < 0;
    });
    if (pageIndex === -1) {
      if (data.pages[lastIndex]!.page.next !== null) continue;
      pageIndex = lastIndex;
    }
    const pageRows = rows[pageIndex]!;
    const at = pageRows.findIndex(row => compare(trace, row) < 0);
    write(pageIndex, at === -1 ? [...pageRows, trace] : [...pageRows.slice(0, at), trace, ...pageRows.slice(at)]);
  }

  if (changed.size === 0) return data;
  return {
    ...data,
    pages: data.pages.map((page, pageIndex) => (changed.has(pageIndex) ? { ...page, traces: rows[pageIndex]! } : page)),
  };
}

/** Queries traces with cursor pagination and viewport-driven loading. */
export function useTraceQuery({
  query,
  limit = TRACE_QUERY_PER_PAGE,
  enabled = true,
  withQueryTrace = true,
  legacyFilters,
  queryOptions,
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
    queryKey: traceQueryKey(query, limit),
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
    enabled: enabled && withQueryTrace,
    ...queryOptions?.traceQuery,
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
    enabled: enabled && !withQueryTrace,
    ...queryOptions?.legacy,
  });
  const result = withQueryTrace ? queryResult : legacyResult;
  const {
    data,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isLoading,
    isPlaceholderData,
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
    isPlaceholderData,
    isFetching,
    isRefetching,
    fetchStatus,
    isError,
    error,
    refetch,
    setEndOfListElement,
  };
}

export interface TraceQueryLatestData {
  /** Opaque server watermark; the next poll sends it back as `after`. */
  deltaCursor: string;
}

export interface UseTraceQueryLatestArgs {
  /** The same `query` passed to `useTraceQuery`. Its `timeRange` and `where` must stay identical across polls. */
  query: TraceQueryArgs | undefined;
  /** The same `limit` passed to `useTraceQuery`, so new traces land in its cache. */
  limit?: number;
  enabled?: boolean;
  /** Polling interval in ms; `false` polls only on mount, focus, or `refetch`. */
  refetchInterval?: number | false;
  /** TanStack options spread last into the underlying `useQuery`. */
  queryOptions?: MastraQueryOptions<TraceQueryLatestData>;
}

function omitOrderBy({ orderBy: _orderBy, ...rest }: TraceQueryArgs) {
  return rest;
}

/** Request timeouts and rate limits clear up on their own, unlike the other 4xx refusals. */
const TRANSIENT_CLIENT_ERROR_STATUSES = new Set([408, 429]);

/** The server refused the request or does not support delta polling; polling again cannot change that. */
function isRejectedDeltaRequest(error: unknown): boolean {
  if (!(error instanceof MastraClientError) || TRANSIENT_CLIENT_ERROR_STATUSES.has(error.status)) return false;
  return (error.status >= 400 && error.status < 500) || error.status === 501;
}

const isCursorConflict = (error: unknown) => error instanceof MastraClientError && error.status === 409;

/**
 * Polls `queryTraces({ mode: 'delta' })` and merges new or updated traces into the list of a
 * `useTraceQuery` rendered with the same `query` and `limit`. The first request only establishes
 * the server cursor; each later poll drains every batch since that cursor. A cursor conflict (409)
 * starts over with a new cursor. A poll that returns while the list is loading a page keeps its
 * cursor and asks again on the next poll, because the page load would overwrite the merge.
 *
 * The cursor is keyed on the query without `orderBy` (delta polls cannot sort) and on `limit`, so
 * re-sorting the list keeps polling from the same cursor, and lists with different page sizes each
 * get their own cursor.
 *
 * Requires the `deltaPolling` capability (see `useTraceQueryDeltaPollingAvailable`). The list's
 * `timeRange.to` must not move between polls, so a live list needs a `to` in the future.
 *
 * Known limitation: the cursor is established in parallel with the list's first page, so a trace
 * that completes between the first page's read and the cursor can be missed until the list is
 * refetched. Traces returned by both are merged by `traceId`.
 */
export function useTraceQueryLatest({
  query,
  limit = TRACE_QUERY_PER_PAGE,
  enabled = true,
  refetchInterval = false,
  queryOptions,
}: UseTraceQueryLatestArgs) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  // Delta mode forbids `orderBy`, and the server cursor is bound to the rest of the query, so the key
  // leaves out `orderBy`: re-sorting the list keeps the cursor. `limit` stays in the key because it
  // picks the list cache the traces merge into.
  const deltaQuery = query && omitOrderBy(query);
  const queryKey = ['trace-query-latest', deltaQuery, limit] as const;

  return useQuery<TraceQueryLatestData>({
    queryKey,
    queryFn:
      query && deltaQuery
        ? async () => {
            const mastra = new MastraClient({ ...client.options, retries: 0 });
            const bootstrap = async () => {
              const response = await mastra.queryTraces({ ...deltaQuery, mode: 'delta' });
              return { deltaCursor: response.deltaCursor };
            };

            const previous = queryClient.getQueryData<TraceQueryLatestData>(queryKey);
            if (!previous) return bootstrap();

            const traces: TraceQueryTrace[] = [];
            let deltaCursor = previous.deltaCursor;
            try {
              for (let hasMore = true; hasMore;) {
                const response = await mastra.queryTraces({
                  ...deltaQuery,
                  mode: 'delta',
                  after: deltaCursor,
                  limit: TRACE_QUERY_DELTA_LIMIT,
                });
                traces.push(...response.traces);
                deltaCursor = response.deltaCursor;
                hasMore = response.delta.hasMore;
              }
            } catch (error) {
              if (isCursorConflict(error)) return bootstrap();
              throw error;
            }

            const listKey = traceQueryKey(query, limit);
            // A list fetch in flight (first page or next page) would overwrite the merge with its own copy of
            // the pages. Keep the previous cursor instead: the next poll asks again from that cursor and gets
            // the same traces back, so nothing is lost.
            if (queryClient.getQueryState(listKey)?.fetchStatus === 'fetching') return previous;
            queryClient.setQueryData<InfiniteData<TraceQueryKeysetTraceResponse>>(listKey, data =>
              data ? mergeTraceQueryDelta(data, traces, query.orderBy) : data,
            );
            return { deltaCursor };
          }
        : skipToken,
    retry: false,
    refetchInterval: q => (isRejectedDeltaRequest(q.state.error) ? false : refetchInterval),
    refetchIntervalInBackground: false,
    enabled: enabled && !!query,
    ...queryOptions,
  });
}
