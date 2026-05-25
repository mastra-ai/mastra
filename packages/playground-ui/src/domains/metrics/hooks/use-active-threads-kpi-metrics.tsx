import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import { useMetricsFilters } from './use-metrics-filters';

/** Active Threads — number of distinct thread IDs observed in agent runs.
 *  Uses approximate `count_distinct` (HyperLogLog on ClickHouse,
 *  `approx_count_distinct` on DuckDB) so the query stays fast even on
 *  tens of millions of rows. */
export function useActiveThreadsKpiMetrics() {
  const client = useMastraClient();
  const { filters, filterKey } = useMetricsFilters();

  return useQuery({
    queryKey: ['metrics', 'active-threads-kpi', filterKey],
    queryFn: () =>
      client.getMetricAggregate({
        name: ['mastra_agent_duration_ms'],
        aggregation: 'count_distinct',
        distinctColumn: 'threadId' as never,
        filters,
        comparePeriod: 'previous_period',
      }),
  });
}
