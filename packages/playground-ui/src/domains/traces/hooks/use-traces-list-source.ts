import { useTraceQuery } from '@mastra/react/hooks';
import type { TraceQueryArgs, UseTraceQueryArgs } from '@mastra/react/hooks';
import { useEffect, useState } from 'react';
import { toTracesListViewTraces } from '../components/traces-list-view-adapter';

export interface UseTracesListSourceArgs {
  query: (now: Date) => TraceQueryArgs;
  orderBy?: TraceQueryArgs['orderBy'];
  rolling?: boolean;
  initialAutoRefetch?: boolean;
  withQueryTrace?: boolean;
  legacyFilters?: UseTraceQueryArgs['legacyFilters'];
  /** Rows per page; defaults to `TRACE_QUERY_PER_PAGE`. */
  limit?: number;
  enabled?: boolean;
}

export function useTracesListSource({
  query: buildQuery,
  orderBy,
  rolling = true,
  initialAutoRefetch = true,
  withQueryTrace,
  legacyFilters,
  limit,
  enabled,
}: UseTracesListSourceArgs) {
  const [now, setNow] = useState(() => new Date());
  const [autoRefetch, setAutoRefetch] = useState(initialAutoRefetch);
  const result = useTraceQuery({
    query: orderBy ? { ...buildQuery(now), orderBy } : buildQuery(now),
    refetchInterval: autoRefetch && !rolling ? 10_000 : false,
    refetchOnWindowFocus: autoRefetch,
    withQueryTrace,
    legacyFilters,
    limit,
    enabled,
  });

  // Moving the query key refreshes the cursor chain once, without a second polling request.
  useEffect(() => {
    if (!autoRefetch || !rolling || result.error) return;
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(timer);
  }, [autoRefetch, rolling, result.error]);

  return {
    ...result,
    rows: toTracesListViewTraces(result.data ?? []),
    autoRefetch,
    setAutoRefetch,
  };
}
