import type {
  LightSpanRecord,
  ListBranchesArgs,
  ListBranchesResponse,
  ListTracesArgs,
  ListTracesResponse,
} from '@mastra/core/storage';
import { useMastraClient } from '@mastra/react';
import type { InfiniteData } from '@tanstack/react-query';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { TraceListMode } from '../trace-filters';
import { useInView } from '@/hooks/use-in-view';
import { is403ForbiddenError } from '@/lib/query-utils';

/**
 * Per-MastraClient delta-polling support cache. Sticks once we observe a 501
 * or a page-0 response without `deltaCursor` (legacy server or store without
 * delta capability), so we don't re-probe on every mount.
 */
type DeltaSupport = 'unknown' | 'unsupported';
const deltaSupportByClient = new WeakMap<ReturnType<typeof useMastraClient>, DeltaSupport>();

/** Tunables for live-tail polling. All fields optional — defaults below.
 *  Platform consumers override individual fields to throttle traffic or
 *  reshape the freshness/visibility trade-offs. */
export interface TracesPollingConfig {
  /** Interval between delta polls. Default 5_000ms. */
  deltaPollIntervalMs?: number;
  /** Refetch delay when the server signals `delta.hasMore` (chase remaining updates immediately). Default 100ms. */
  deltaChaseIntervalMs?: number;
  /** Max rows per delta poll. Server caps at 100. Default 100. */
  deltaLimit?: number;
  /** Page-mode refetch interval used when the configured store does not support delta polling. Default 10_000ms. */
  pageModeRefetchIntervalMs?: number;
  /** Periodic page-0 refetch interval while delta is active. Delta only delivers new rows, so this
   *  is how we surface status flips (running → success/error) on rows already visible. Default 60_000ms. */
  page0StatusRefreshIntervalMs?: number;
  /** When the tab returns from being hidden and the last successful poll was older than this, the
   *  cursor is treated as stale (ClickHouse delta tables TTL after 2 days; other stores may be more
   *  aggressive). The infinite query is reset so page 0 refetches and delta resumes from a fresh
   *  cursor. Default 900_000ms (15 min). */
  idleGuardThresholdMs?: number;
  /** Minimum visible duration for `isRefetching` after any query completes. On localhost a delta
   *  poll can resolve in tens of ms — too brief for the spinner's 1s rotation to register visually,
   *  and quick enough that React may batch the start/finish transitions. Pulsing for this duration
   *  on completion (~144° of rotation at 400ms) makes each poll perceptible as a heartbeat.
   *  Default 400ms. */
  minRefetchSpinMs?: number;
  /** Window during which a delta-arrived row's key stays in `recentlyAddedKeys` so the list view
   *  can apply its `animate-row-highlight` class. Should match the CSS animation duration
   *  (currently 1_000ms — see `index.css`). Default 1_000ms. */
  deltaHighlightMs?: number;
}

const DEFAULT_POLLING_CONFIG: Required<TracesPollingConfig> = {
  deltaPollIntervalMs: 5_000,
  deltaChaseIntervalMs: 100,
  deltaLimit: 100,
  pageModeRefetchIntervalMs: 10_000,
  page0StatusRefreshIntervalMs: 60_000,
  idleGuardThresholdMs: 15 * 60_000,
  minRefetchSpinMs: 400,
  deltaHighlightMs: 1_000,
};

/** Returns true when the cursor should be considered stale and re-seeded.
 *  Exported for testing — pure function of timestamps. */
export function shouldResetAfterIdle(lastSuccessAt: number, now: number, thresholdMs: number): boolean {
  if (lastSuccessAt === 0) return false;
  return now - lastSuccessAt > thresholdMs;
}

function isHttp501(error: unknown): boolean {
  return (error as { status?: number } | null)?.status === 501;
}

type FetchTracesFnArgs = TracesFilters & {
  client: ReturnType<typeof useMastraClient>;
} & ({ mode: 'delta'; after?: string; limit?: number } | { mode?: 'page'; page: number; perPage: number });

const fetchTracesFn = async (args: FetchTracesFnArgs) => {
  const { client, filters, listMode = 'traces' } = args;
  const params =
    args.mode === 'delta'
      ? { mode: 'delta' as const, after: args.after, limit: args.limit, filters }
      : { pagination: { page: args.page, perPage: args.perPage }, filters };

  if (listMode === 'branches') {
    return client.listBranches(params as ListBranchesArgs);
  }

  return client.listTraces(params as ListTracesArgs);
};

export const TRACES_PER_PAGE = 25;

export interface TracesFilters {
  filters?: ListTracesArgs['filters'] | ListBranchesArgs['filters'];
  listMode?: TraceListMode;
}

/** Returns the next page number if the server indicates more pages are available. */
export function getTracesNextPageParam(
  lastPage: ListTracesResponse | ListBranchesResponse | undefined,
  _allPages: unknown,
  lastPageParam: number,
) {
  if (lastPage?.pagination?.hasMore) {
    return lastPageParam + 1;
  }
  return undefined;
}

type TracesPageResponse = ListTracesResponse | ListBranchesResponse;

function getPageSpans(page: TracesPageResponse) {
  if ('branches' in page) return page.branches ?? [];
  return page.spans ?? [];
}

/** Deduplicates trace/branch rows by traceId + spanId across all loaded pages.
 *  Also surfaces page 0's deltaCursor so the live-tail query can read it reactively. */
export function selectUniqueTraces(data: { pages: TracesPageResponse[] }): {
  spans: LightSpanRecord[];
  deltaCursor: string | undefined;
} {
  const seen = new Set<string>();
  const spans = data.pages
    .flatMap(page => getPageSpans(page))
    .filter(span => {
      const key = `${span.traceId}:${span.spanId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return { spans, deltaCursor: data.pages[0]?.deltaCursor };
}

/** Replaces existing page-0 rows in place (keyed by traceId:spanId) with
 *  refreshed copies from the server. Rows the server doesn't return are kept
 *  as-is so delta-accumulated rows that have aged off the server's page 0
 *  aren't dropped from the UI. New rows aren't added here — delta polling
 *  delivers those. */
export function refreshPage0Rows(
  old: InfiniteData<TracesPageResponse> | undefined,
  refreshed: ListTracesResponse | ListBranchesResponse,
  listMode: TraceListMode,
): InfiniteData<TracesPageResponse> | undefined {
  if (!old || old.pages.length === 0) return old;
  const [firstPage, ...rest] = old.pages;
  if (!firstPage) return old;

  const refreshedRows =
    listMode === 'branches' && 'branches' in refreshed
      ? (refreshed.branches ?? [])
      : 'spans' in refreshed
        ? (refreshed.spans ?? [])
        : [];

  if (refreshedRows.length === 0) return old;

  const refreshedByKey = new Map<string, (typeof refreshedRows)[number]>();
  for (const row of refreshedRows) {
    refreshedByKey.set(`${row.traceId}:${row.spanId}`, row);
  }

  let updatedFirst: TracesPageResponse;
  if (listMode === 'branches' && 'branches' in firstPage) {
    const updated = (firstPage.branches ?? []).map(existing => {
      const fresh = refreshedByKey.get(`${existing.traceId}:${existing.spanId}`);
      return fresh ?? existing;
    });
    updatedFirst = { ...firstPage, branches: updated };
  } else if ('spans' in firstPage) {
    const updated = (firstPage.spans ?? []).map(existing => {
      const fresh = refreshedByKey.get(`${existing.traceId}:${existing.spanId}`);
      return fresh ?? existing;
    });
    updatedFirst = { ...firstPage, spans: updated };
  } else {
    return old;
  }

  return { ...old, pages: [updatedFirst, ...rest] };
}

/** Stable `startedAt DESC` sort matching the server's default page-mode
 *  ordering for both list endpoints. Rows missing `startedAt` sink to the
 *  bottom (compared as time 0). */
function sortRowsByStartedAtDesc<T extends { startedAt?: unknown }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aTime = a.startedAt ? new Date(a.startedAt as string | number | Date).getTime() : 0;
    const bTime = b.startedAt ? new Date(b.startedAt as string | number | Date).getTime() : 0;
    return bTime - aTime;
  });
}

/** Prepends delta-mode rows into page 0 and advances its deltaCursor.
 *  Delta responses come back in server cursor order (insertion order into
 *  the per-store delta index), not the `startedAt DESC` order page-mode
 *  uses — so we re-sort the merged page 0 to match what the user sees on
 *  a fresh page-mode load. Cross-page duplication is handled later by
 *  selectUniqueTraces. */
export function mergeDeltaIntoPage0(
  old: InfiniteData<TracesPageResponse> | undefined,
  delta: ListTracesResponse | ListBranchesResponse,
  listMode: TraceListMode,
): InfiniteData<TracesPageResponse> | undefined {
  if (!old || old.pages.length === 0) return old;
  const [firstPage, ...rest] = old.pages;
  if (!firstPage) return old;
  const nextCursor = delta.deltaCursor ?? firstPage.deltaCursor;

  let updatedFirst: TracesPageResponse;
  if (listMode === 'branches' && 'branches' in firstPage) {
    const newRows = (delta as ListBranchesResponse).branches ?? [];
    updatedFirst = {
      ...firstPage,
      branches: sortRowsByStartedAtDesc([...newRows, ...(firstPage.branches ?? [])]),
      deltaCursor: nextCursor,
    };
  } else if ('spans' in firstPage) {
    const newRows = (delta as ListTracesResponse).spans ?? [];
    updatedFirst = {
      ...firstPage,
      spans: sortRowsByStartedAtDesc([...newRows, ...(firstPage.spans ?? [])]),
      deltaCursor: nextCursor,
    };
  } else {
    return old;
  }

  return { ...old, pages: [updatedFirst, ...rest] };
}

export interface UseTracesArgs extends TracesFilters {
  /** Optional overrides for the live-tail polling tunables. Any omitted fields fall back to the
   *  built-in defaults; pass only what you want to change. */
  polling?: TracesPollingConfig;
}

interface UseTracesReturn {
  data: { spans: LightSpanRecord[]; deltaCursor: string | undefined } | undefined;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  setEndOfListElement: (node: HTMLDivElement | null) => void;
  isRefetching: boolean;
  autoRefetch: boolean;
  setAutoRefetch: (v: boolean) => void;
  recentlyAddedKeys: Set<string>;
  dataUpdatedAt: number;
  errorUpdatedAt: number;
  isFetching: boolean;
  isSuccess: boolean;
  fetchStatus: 'idle' | 'fetching' | 'paused';
  refetch: () => void;
}

export const useTraces: (args: UseTracesArgs) => UseTracesReturn = ({
  filters,
  listMode = 'traces',
  polling = {},
}: UseTracesArgs) => {
  const {
    deltaPollIntervalMs = DEFAULT_POLLING_CONFIG.deltaPollIntervalMs,
    deltaChaseIntervalMs = DEFAULT_POLLING_CONFIG.deltaChaseIntervalMs,
    deltaLimit = DEFAULT_POLLING_CONFIG.deltaLimit,
    pageModeRefetchIntervalMs = DEFAULT_POLLING_CONFIG.pageModeRefetchIntervalMs,
    page0StatusRefreshIntervalMs = DEFAULT_POLLING_CONFIG.page0StatusRefreshIntervalMs,
    idleGuardThresholdMs = DEFAULT_POLLING_CONFIG.idleGuardThresholdMs,
    minRefetchSpinMs = DEFAULT_POLLING_CONFIG.minRefetchSpinMs,
    deltaHighlightMs = DEFAULT_POLLING_CONFIG.deltaHighlightMs,
  } = polling;
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { inView: isEndOfListInView, setRef: setEndOfListElement } = useInView();

  const [deltaSupport, setDeltaSupport] = useState<DeltaSupport>(() => deltaSupportByClient.get(client) ?? 'unknown');
  const deltaUnsupported = deltaSupport === 'unsupported';

  // When false, all automatic polling stops: delta polls, status refresh,
  // idle-guard resets, and the page-mode fallback interval. Manual `resync`
  // still works. Session-scoped (no persistence across mounts).
  const [autoRefetch, setAutoRefetch] = useState(true);

  // Keys (`traceId:spanId`) of rows that arrived via the most recent delta
  // poll(s). The list view reads this to apply a temporary highlight class
  // for deltaHighlightMs, then they auto-expire. Resets on filter/listMode
  // change since a new query key spawns a fresh list.
  const [recentlyAddedKeys, setRecentlyAddedKeys] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setRecentlyAddedKeys(new Set());
  }, [listMode, filters]);

  const tracesQueryKey = ['traces', listMode, filters] as const;

  const query = useInfiniteQuery({
    queryKey: tracesQueryKey,
    queryFn: ({ pageParam }) =>
      fetchTracesFn({
        client,
        page: pageParam,
        perPage: TRACES_PER_PAGE,
        filters,
        listMode,
      }),
    initialPageParam: 0,
    getNextPageParam: getTracesNextPageParam,
    select: selectUniqueTraces,
    retry: false,
    // Disable polling on 403 to prevent flickering.
    // Fall back to page-mode polling only when delta isn't running.
    refetchInterval: q => {
      if (is403ForbiddenError(q.state.error)) return false;
      if (!autoRefetch) return false;
      return deltaUnsupported ? pageModeRefetchIntervalMs : false;
    },
  });

  const cursor = query.data?.deltaCursor;

  // If page 0 came back without a deltaCursor, the server/store doesn't
  // support delta polling. Pin the client to 'unsupported' so the infinite
  // query resumes page-mode polling and we stop probing.
  useEffect(() => {
    if (query.isSuccess && cursor === undefined && deltaSupport === 'unknown') {
      deltaSupportByClient.set(client, 'unsupported');
      setDeltaSupport('unsupported');
    }
  }, [query.isSuccess, cursor, deltaSupport, client]);

  const deltaQuery = useQuery({
    queryKey: ['traces-delta', listMode, filters] as const,
    queryFn: () => {
      const current = queryClient.getQueryData<InfiniteData<TracesPageResponse>>(tracesQueryKey)?.pages[0]?.deltaCursor;
      if (!current) return null;
      return fetchTracesFn({
        client,
        mode: 'delta',
        after: current,
        limit: deltaLimit,
        filters,
        listMode,
      });
    },
    enabled: !!cursor && !deltaUnsupported && autoRefetch,
    retry: false,
    refetchInterval: q => {
      if (q.state.error) return false;
      const data = q.state.data as ListTracesResponse | ListBranchesResponse | null | undefined;
      if (data?.delta?.hasMore) return deltaChaseIntervalMs;
      return deltaPollIntervalMs;
    },
  });

  // Merge new delta rows into the infinite-query cache. Also captures the
  // arrived keys into `recentlyAddedKeys` for deltaHighlightMs so the UI
  // can briefly distinguish them. The cleanup timer is intentionally NOT
  // tied to the effect lifecycle — if a newer delta arrives first, we still
  // want each prior batch to expire on its own schedule.
  useEffect(() => {
    const result = deltaQuery.data;
    if (!result) return;
    queryClient.setQueryData<InfiniteData<TracesPageResponse>>(tracesQueryKey, old =>
      mergeDeltaIntoPage0(old, result, listMode),
    );

    const newRows =
      listMode === 'branches' && 'branches' in result
        ? (result.branches ?? [])
        : 'spans' in result
          ? (result.spans ?? [])
          : [];
    if (newRows.length === 0) return;
    const keys = newRows.map(r => `${r.traceId}:${r.spanId ?? ''}`);
    setRecentlyAddedKeys(prev => {
      const next = new Set(prev);
      for (const k of keys) next.add(k);
      return next;
    });
    setTimeout(() => {
      setRecentlyAddedKeys(prev => {
        const next = new Set(prev);
        for (const k of keys) next.delete(k);
        return next;
      });
    }, deltaHighlightMs);
    // tracesQueryKey is a new array each render but its contents drive cache keying;
    // depending on its members (listMode/filters) is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deltaQuery.data, queryClient, listMode, filters, deltaHighlightMs]);

  // A 501 means the server is too old (or store doesn't support delta) — pin
  // 'unsupported' so the delta query disables and page-mode polling resumes.
  useEffect(() => {
    if (isHttp501(deltaQuery.error)) {
      deltaSupportByClient.set(client, 'unsupported');
      setDeltaSupport('unsupported');
    }
  }, [deltaQuery.error, client]);

  // Periodic page-0 refresh to surface status updates on visible rows
  // (running → success/error). Only runs while delta is the primary polling
  // mechanism; otherwise the infinite query's own refetchInterval covers it.
  const statusRefreshQuery = useQuery({
    queryKey: ['traces-status-refresh', listMode, filters] as const,
    queryFn: () =>
      fetchTracesFn({
        client,
        page: 0,
        perPage: TRACES_PER_PAGE,
        filters,
        listMode,
      }),
    enabled: !!cursor && !deltaUnsupported && autoRefetch,
    refetchInterval: page0StatusRefreshIntervalMs,
    refetchOnMount: false,
    retry: false,
  });

  useEffect(() => {
    const result = statusRefreshQuery.data;
    if (!result) return;
    queryClient.setQueryData<InfiniteData<TracesPageResponse>>(tracesQueryKey, old =>
      refreshPage0Rows(old, result, listMode),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusRefreshQuery.data, queryClient, listMode, filters]);

  // Idle guard: when the tab returns from being hidden, check how long it's
  // been since the last successful poll. If past the threshold, reset the
  // infinite query so page 0 refetches and the cursor is re-seeded.
  const lastSuccessAtRef = useRef(0);
  useEffect(() => {
    const ts = Math.max(query.dataUpdatedAt, deltaQuery.dataUpdatedAt, statusRefreshQuery.dataUpdatedAt);
    if (ts > lastSuccessAtRef.current) {
      lastSuccessAtRef.current = ts;
    }
  }, [query.dataUpdatedAt, deltaQuery.dataUpdatedAt, statusRefreshQuery.dataUpdatedAt]);

  // Track autoRefetch in a ref so the visibility listener (attached once)
  // reads the current value without needing to re-attach.
  const autoRefetchRef = useRef(autoRefetch);
  useEffect(() => {
    autoRefetchRef.current = autoRefetch;
  }, [autoRefetch]);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState !== 'visible') return;
      if (!autoRefetchRef.current) return;
      if (!shouldResetAfterIdle(lastSuccessAtRef.current, Date.now(), idleGuardThresholdMs)) return;
      void queryClient.resetQueries({ queryKey: ['traces', listMode, filters] });
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [queryClient, listMode, filters, idleGuardThresholdMs]);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    if (isEndOfListInView && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [isEndOfListInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // `isRefetching` aggregates every active fetch — page-mode (initial, next
  // page, manual resync, idle reset), the 60s page-0 status refresh, AND the
  // delta polls — so a spinner bound to it acts as a heartbeat indicator.
  //
  // Short polls (e.g. delta on localhost) can resolve in tens of ms — too
  // brief for `animate-spin` (1s/rotation) to register visually, and quick
  // enough that React may batch the start/finish transitions so we never
  // even observe `isFetching: true`. So we also watch every query's
  // data/errorUpdatedAt; any advance pulses `isRefetching` true for at least
  // minRefetchSpinMs, which is ~144° of rotation — clearly perceptible.
  const isFetchingAny = query.isFetching || statusRefreshQuery.isFetching || deltaQuery.isFetching;
  const lastActivityAt = Math.max(
    query.dataUpdatedAt,
    query.errorUpdatedAt,
    deltaQuery.dataUpdatedAt,
    deltaQuery.errorUpdatedAt,
    statusRefreshQuery.dataUpdatedAt,
    statusRefreshQuery.errorUpdatedAt,
  );
  const [pulse, setPulse] = useState(false);
  const prevActivityAtRef = useRef(lastActivityAt);
  useEffect(() => {
    if (lastActivityAt > prevActivityAtRef.current) {
      prevActivityAtRef.current = lastActivityAt;
      setPulse(true);
      const t = setTimeout(() => setPulse(false), minRefetchSpinMs);
      return () => clearTimeout(t);
    }
  }, [lastActivityAt, minRefetchSpinMs]);
  const isRefetching = isFetchingAny || pulse;

  return {
    ...query,
    setEndOfListElement,
    isRefetching,
    autoRefetch,
    setAutoRefetch,
    recentlyAddedKeys,
  };
};
