import { toTracesListViewTraces } from '@mastra/playground-ui/domains/traces/components/traces-list-view-adapter';
import { useTraceQuery } from '@mastra/playground-ui/domains/traces/hooks/use-trace-query';
import type { TraceQueryArgs } from '@mastra/playground-ui/domains/traces/hooks/use-trace-query';
import { useEffect, useState } from 'react';

export function useTracesListSource({
  query: buildQuery,
  rolling = true,
}: {
  query: (now: Date) => TraceQueryArgs;
  rolling?: boolean;
}) {
  const [now, setNow] = useState(() => new Date());
  const [autoRefetch, setAutoRefetch] = useState(true);
  const result = useTraceQuery({
    query: buildQuery(now),
    refetchInterval: autoRefetch && !rolling ? 10_000 : false,
    refetchOnWindowFocus: true,
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
