import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraQueryOptions } from '../shared/query-options';
import { chooseMetricsInterval, formatMetricsBucketLabel } from './metrics-interval';
import type { MetricsInterval } from './metrics-interval';
import type { MetricsQueryFilters } from './metrics-query-filters';

export interface LatencyPoint {
  [key: string]: unknown;
  time: string;
  /** Raw timestamp (ms since epoch) for the bucket this point represents.
   *  Used by drilldown clicks to compute a narrow time window. */
  tsMs: number;
  p50: number;
  p95: number;
}

async function fetchPercentiles(
  client: ReturnType<typeof useMastraClient>,
  metricName: string,
  filters: Record<string, unknown>,
  interval: MetricsInterval,
): Promise<LatencyPoint[]> {
  const res = await client.getMetricPercentiles({
    name: metricName,
    percentiles: [0.5, 0.95],
    interval,
    filters,
  });

  const p50Series = res.series.find(s => s.percentile === 0.5);
  const p95Series = res.series.find(s => s.percentile === 0.95);

  if (!p50Series || !p95Series) return [];

  const p95Map = new Map(p95Series.points.map(p => [new Date(p.timestamp).getTime(), p.value]));

  return p50Series.points.map(p => {
    const ts = new Date(p.timestamp);
    const tsMs = ts.getTime();
    return {
      time: formatMetricsBucketLabel(ts, interval),
      tsMs,
      p50: Math.round(p.value),
      p95: Math.round(p95Map.get(tsMs) ?? 0),
    };
  });
}

export interface LatencyMetricsData {
  agentData: LatencyPoint[];
  workflowData: LatencyPoint[];
  toolData: LatencyPoint[];
  interval: MetricsInterval;
}

export function useLatencyMetrics<TData = LatencyMetricsData>(
  params: MetricsQueryFilters & { queryOptions?: MastraQueryOptions<LatencyMetricsData, TData> },
): UseQueryResult<TData, Error> {
  const client = useMastraClient();
  const { timestamp, filters, filterKey, queryOptions } = params;
  const interval = chooseMetricsInterval(timestamp);

  return useQuery({
    queryKey: ['metrics', 'latency', filterKey, interval],
    queryFn: async (): Promise<LatencyMetricsData> => {
      const [agentData, workflowData, toolData] = await Promise.all([
        fetchPercentiles(client, 'mastra_agent_duration_ms', filters, interval),
        fetchPercentiles(client, 'mastra_workflow_duration_ms', filters, interval),
        fetchPercentiles(client, 'mastra_tool_duration_ms', filters, interval),
      ]);
      return { agentData, workflowData, toolData, interval };
    },
    ...queryOptions,
  });
}
