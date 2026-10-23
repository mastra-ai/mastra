import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMetricsFilters } from './use-metrics-filters';
import { TOKEN_SERIES_METRICS } from './use-metrics-token-series';
import type { TokenSeriesOptions } from './use-metrics-token-series';

/**
 * Tokens and cost per group as totals over a window, with the page's other filters: the
 * Breakdown card's Models and Threads tabs, and every tab's previous window.
 */
export function useMetricsUsageTotals({
  groupBy,
  filters: extra,
  window,
  enabled = true,
}: TokenSeriesOptions & { window: { start: Date; end: Date } }) {
  const client = useMastraClient();
  const { filters, filterKey } = useMetricsFilters();

  return useQuery({
    queryKey: [
      'metrics',
      'cost-breakdown',
      groupBy,
      extra ?? null,
      filterKey,
      window.start.toISOString(),
      window.end.toISOString(),
    ],
    staleTime: Infinity,
    enabled,
    queryFn: () =>
      client.getMetricBreakdown({
        name: TOKEN_SERIES_METRICS,
        groupBy,
        aggregation: 'sum',
        orderDirection: 'DESC',
        limit: 1000,
        filters: { ...filters, ...extra, timestamp: window },
      }),
  });
}
