import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import { getOrCreate } from '../shared/map';
import type { MastraQueryOptions } from '../shared/query-options';
import type { MetricsQueryFilters } from './metrics-query-filters';

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

export interface TraceVolumeData {
  agentData: VolumeRow[];
  workflowData: VolumeRow[];
  toolData: VolumeRow[];
}

export function useTraceVolumeMetrics<TData = TraceVolumeData>(
  params: MetricsQueryFilters & { queryOptions?: MastraQueryOptions<TraceVolumeData, TData> },
): UseQueryResult<TData, Error> {
  const client = useMastraClient();
  const { filters, filterKey, queryOptions } = params;

  return useQuery({
    queryKey: ['metrics', 'trace-volume', filterKey],
    queryFn: async (): Promise<TraceVolumeData> => {
      const [agentData, workflowData, toolData] = await Promise.all([
        fetchVolume(client, 'mastra_agent_duration_ms', filters),
        fetchVolume(client, 'mastra_workflow_duration_ms', filters),
        fetchVolume(client, 'mastra_tool_duration_ms', filters),
      ]);
      return { agentData, workflowData, toolData };
    },
    ...queryOptions,
  });
}
