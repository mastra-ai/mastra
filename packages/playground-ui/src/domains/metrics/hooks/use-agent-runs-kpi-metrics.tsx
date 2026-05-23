import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMetricsFilters } from './use-metrics-filters';

type UseAgentRunsKpiMetricsOptions = {
  enabled?: boolean;
};

/** Total Agent Runs — count of agent duration metric observations */
export function useAgentRunsKpiMetrics({ enabled = true }: UseAgentRunsKpiMetricsOptions = {}) {
  const client = useMastraClient();
  const { filters, filterKey } = useMetricsFilters();

  return useQuery({
    queryKey: ['metrics', 'agent-runs-kpi', filterKey],
    queryFn: () =>
      client.getMetricAggregate({
        name: ['mastra_agent_duration_ms'],
        aggregation: 'count',
        filters,
        comparePeriod: 'previous_period',
      }),
    enabled,
  });
}
