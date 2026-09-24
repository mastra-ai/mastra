import { useEffect, useState } from 'react';
import { toTracesListViewTraces } from '../components/traces-list-view-adapter';
import { useTraceQuery } from './use-trace-query';
import type { TraceQueryArgs, UseTraceQueryArgs } from './use-trace-query';

export interface UseTracesListSourceArgs {
  query: (now: Date) => TraceQueryArgs;
  orderBy?: TraceQueryArgs['orderBy'];
  rolling?: boolean;
  initialAutoRefetch?: boolean;
  withQueryTrace?: boolean;
  legacyFilters?: UseTraceQueryArgs['legacyFilters'];
  enabled?: boolean;
}

export function useTracesListSource({
  query: buildQuery,
  orderBy,
  rolling = true,
  initialAutoRefetch = true,
  withQueryTrace,
  legacyFilters,
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
