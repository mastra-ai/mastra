import type { MastraClient } from '@mastra/client-js';
import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';
import type { MetricsQueryFilters } from './metrics-query-filters';

/** Total Agent Runs — count of agent duration metric observations */
export function useAgentRunsKpiMetrics<TData = Awaited<ReturnType<MastraClient['getMetricAggregate']>>>(
  params: MetricsQueryFilters & {
    queryOptions?: MastraQueryOptions<Awaited<ReturnType<MastraClient['getMetricAggregate']>>, TData>;
  },
): UseQueryResult<TData, Error> {
  const client = useMastraClient();
  const { filters, filterKey, queryOptions } = params;

  return useQuery({
    queryKey: ['metrics', 'agent-runs-kpi', filterKey],
    queryFn: () =>
      client.getMetricAggregate({
        name: ['mastra_agent_duration_ms'],
        aggregation: 'count',
        filters,
        comparePeriod: 'previous_period',
      }),
    ...queryOptions,
  });
}
