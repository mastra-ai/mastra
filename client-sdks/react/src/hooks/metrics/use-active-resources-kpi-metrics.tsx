import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';

import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';
import type { MetricsQueryFilters } from './metrics-query-filters';

/** Active Resources — number of distinct resource IDs observed in agent runs.
 *  Uses approximate `count_distinct` (HyperLogLog on ClickHouse,
 *  `approx_count_distinct` on DuckDB) so the query stays fast even on
 *  tens of millions of rows. */
export function useActiveResourcesKpiMetrics<TData = Awaited<ReturnType<MastraClient['getMetricAggregate']>>>(
  params: MetricsQueryFilters & {
    queryOptions?: MastraQueryOptions<Awaited<ReturnType<MastraClient['getMetricAggregate']>>, TData>;
  },
): UseQueryResult<TData, Error> {
  const client = useMastraClient();
  const { filters, filterKey, queryOptions } = params;

  return useQuery({
    queryKey: ['metrics', 'active-resources-kpi', filterKey],
    queryFn: () =>
      client.getMetricAggregate({
        name: ['mastra_agent_duration_ms'],
        aggregation: 'count_distinct',
        distinctColumn: 'resourceId' as never,
        filters,
        comparePeriod: 'previous_period',
      }),
    ...queryOptions,
  });
}
