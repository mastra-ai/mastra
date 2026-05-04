import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMetricsFilters } from './use-metrics-filters';

/** Total Agent Runs — count of agent duration metric observations */
export function useAgentRunsKpiMetrics() {
  const client = useMastraClient();
  const { datePreset, customRange, timestamp } = useMetricsFilters();

  return useQuery({
    queryKey: ['metrics', 'agent-runs-kpi', datePreset, customRange],
    queryFn: () =>
      client.getMetricAggregate({
        name: ['mastra_agent_duration_ms'],
        aggregation: 'count',
        filters: { timestamp },
        comparePeriod: 'previous_period',
      }),
  });
}
