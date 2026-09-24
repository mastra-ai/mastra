import { toTracesListViewTraces } from '@mastra/playground-ui/domains/traces/components/traces-list-view-adapter';
import { useTraceQuery } from '@mastra/playground-ui/domains/traces/hooks/use-trace-query';
import type { TraceQueryArgs, UseTraceQueryArgs } from '@mastra/playground-ui/domains/traces/hooks/use-trace-query';
import { useEffect, useState } from 'react';

export function useTracesListSource({
  query: buildQuery,
  orderBy,
  rolling = true,
  initialAutoRefetch = true,
  withQueryTrace,
  legacyFilters,
}: {
  query: (now: Date) => TraceQueryArgs;
  orderBy?: TraceQueryArgs['orderBy'];
  rolling?: boolean;
  initialAutoRefetch?: boolean;
  withQueryTrace?: boolean;
  legacyFilters?: UseTraceQueryArgs['legacyFilters'];
}) {
  const [now, setNow] = useState(() => new Date());
  const [autoRefetch, setAutoRefetch] = useState(initialAutoRefetch);
  const result = useTraceQuery({
    query: orderBy ? { ...buildQuery(now), orderBy } : buildQuery(now),
    refetchInterval: autoRefetch && !rolling ? 10_000 : false,
    refetchOnWindowFocus: autoRefetch,
    withQueryTrace,
    legacyFilters,
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
