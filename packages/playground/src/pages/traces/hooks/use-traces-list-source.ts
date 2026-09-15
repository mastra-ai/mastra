import { toTracesListViewTraces } from '@mastra/playground-ui/domains/traces/components/traces-list-view-adapter';
import { useTraceQuery } from '@mastra/playground-ui/domains/traces/hooks/use-trace-query';
import type { TraceQueryArgs } from '@mastra/playground-ui/domains/traces/hooks/use-trace-query';
import { useTraces } from '@mastra/playground-ui/domains/traces/hooks/use-traces';
import { useEffect, useState, useSyncExternalStore } from 'react';

let traceQueryUnsupported = false;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => traceQueryUnsupported;

function isUnsupported(error: Error | null) {
  return (
    error !== null &&
    (('status' in error && error.status === 501) || ('code' in error && error.code === 'TRACE_QUERY_UNSUPPORTED'))
  );
}

export function useTracesListSource({
  filters,
  listMode = 'traces',
  query: buildQuery,
  rolling = true,
}: Pick<Parameters<typeof useTraces>[0], 'filters' | 'listMode'> & {
  query: (now: Date) => TraceQueryArgs | null;
  rolling?: boolean;
}) {
  const [now, setNow] = useState(() => new Date());
  const unsupported = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const query = buildQuery(now);
  const useQuerySource = listMode === 'traces' && query !== null && !unsupported;
  const list = useTraces({ filters, listMode, enabled: !useQuerySource });
  const result = useTraceQuery({
    query: query ?? undefined,
    enabled: useQuerySource,
    refetchInterval: useQuerySource && list.autoRefetch && !rolling ? 10_000 : false,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!isUnsupported(result.error)) return;
    traceQueryUnsupported = true;
    for (const listener of listeners) listener();
  }, [result.error]);

  // Moving the query key refreshes the cursor chain once, without a second polling request.
  useEffect(() => {
    if (!useQuerySource || !list.autoRefetch || !rolling) return;
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(timer);
  }, [useQuerySource, list.autoRefetch, rolling]);

  const active = useQuerySource ? result : list;
  return {
    rows: useQuerySource ? toTracesListViewTraces(result.data ?? []) : (list.data?.spans ?? []),
    isLoading: active.isLoading,
    isFetchingNextPage: active.isFetchingNextPage,
    hasNextPage: active.hasNextPage,
    fetchNextPage: active.fetchNextPage,
    setEndOfListElement: active.setEndOfListElement,
    error: active.error,
    isRefetching: active.isRefetching,
    recentlyAddedKeys: useQuerySource ? undefined : list.recentlyAddedKeys,
    autoRefetch: list.autoRefetch,
    setAutoRefetch: list.setAutoRefetch,
    source: useQuerySource ? ('query' as const) : ('list' as const),
  };
}
