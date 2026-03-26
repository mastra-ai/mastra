import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import { useMetricsFilters } from './use-metrics-filters';

export interface VolumeRow {
  name: string;
  completed: number;
  errors: number;
}

async function fetchVolume(
  client: ReturnType<typeof useMastraClient>,
  metricName: string,
  timestamp: { start: Date; end: Date },
): Promise<VolumeRow[]> {
  const res = await client.getMetricBreakdown({
    name: [metricName],
    groupBy: ['entityName', 'status'],
    aggregation: 'count',
    filters: { timestamp },
  });

  const map = new Map<string, { completed: number; errors: number }>();

  for (const group of res.groups) {
    const name = group.dimensions.entityName ?? 'unknown';
    const status = group.dimensions.status ?? 'ok';
    if (!map.has(name)) {
      map.set(name, { completed: 0, errors: 0 });
    }
    const entry = map.get(name)!;
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
  const { datePreset, customRange, timestamp } = useMetricsFilters();

  return useQuery({
    queryKey: ['metrics', 'trace-volume', datePreset, customRange],
    queryFn: async () => {
      const [agentData, workflowData, toolData] = await Promise.all([
        fetchVolume(client, 'mastra_agent_duration_ms', timestamp),
        fetchVolume(client, 'mastra_workflow_duration_ms', timestamp),
        fetchVolume(client, 'mastra_tool_duration_ms', timestamp),
      ]);
      return { agentData, workflowData, toolData };
    },
  });
}
