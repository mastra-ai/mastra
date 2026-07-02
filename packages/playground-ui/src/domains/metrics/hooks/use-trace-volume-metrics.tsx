import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMetricsFilters } from './use-metrics-filters';
import { getOrCreate } from '@/lib/map';

export interface VolumeRow {
  name: string;
  completed: number;
  errors: number;
}

async function fetchVolume(
  client: ReturnType<typeof useMastraClient>,
  metricName: string,
  filters: Record<string, unknown>,
): Promise<VolumeRow[]> {
  const res = await client.getMetricBreakdown({
    name: [metricName],
    groupBy: ['entityName', 'status'],
    aggregation: 'count',
    orderDirection: 'DESC',
    filters,
  });

  const map = new Map<string, { completed: number; errors: number }>();

  for (const group of res.groups) {
    const name = group.dimensions.entityName ?? 'unknown';
    const status = group.dimensions.status ?? 'ok';
    const entry = getOrCreate(map, name, () => ({ completed: 0, errors: 0 }));

    if (status === 'error') {
      entry.errors += group.value;
    } else {
      entry.completed += group.value;
    }
  }

  return Array.from(map.entries())
    .map(([name, vals]) => ({ name, ...vals }))
    .sort((a, b) => b.completed + b.errors - (a.completed + a.errors));
}

export function useTraceVolumeMetrics() {
  const client = useMastraClient();
  const { filters, filterKey } = useMetricsFilters();

  return useQuery({
    queryKey: ['metrics', 'trace-volume', filterKey],
    queryFn: async () => {
      const [agentData, workflowData, toolData] = await Promise.all([
        fetchVolume(client, 'mastra_agent_duration_ms', filters),
        fetchVolume(client, 'mastra_workflow_duration_ms', filters),
        fetchVolume(client, 'mastra_tool_duration_ms', filters),
      ]);
      return { agentData, workflowData, toolData };
    },
  });
}
