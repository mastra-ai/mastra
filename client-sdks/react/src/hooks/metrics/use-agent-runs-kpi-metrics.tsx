import { useQuery } from '@tanstack/react-query';
import type { MetricsQueryFilters } from './metrics-query-filters';
import { useMastraClient } from '@/mastra-client-context';

/** Total Agent Runs — count of agent duration metric observations */
export function useAgentRunsKpiMetrics(params: MetricsQueryFilters) {
  const client = useMastraClient();
  const { filters, filterKey } = params;

  return useQuery({
    queryKey: ['metrics', 'agent-runs-kpi', filterKey],
    queryFn: () =>
      client.getMetricAggregate({
        name: ['mastra_agent_duration_ms'],
        aggregation: 'count',
        filters,
        comparePeriod: 'previous_period',
      }),
  });
}
