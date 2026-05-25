import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMetricsFilters } from './use-metrics-filters';

export interface LatencyPoint {
  [key: string]: unknown;
  time: string;
  /** Raw timestamp (ms since epoch) for the bucket this point represents.
   *  Used by drilldown clicks to compute a narrow time window. */
  tsMs: number;
  p50: number;
  p95: number;
}

export const LATENCY_INTERVAL: '1h' = '1h';

async function fetchPercentiles(
  client: ReturnType<typeof useMastraClient>,
  metricName: string,
  filters: Record<string, unknown>,
): Promise<LatencyPoint[]> {
  const res = await client.getMetricPercentiles({
    name: metricName,
    percentiles: [0.5, 0.95],
    interval: LATENCY_INTERVAL,
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
      time: ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      tsMs,
      p50: Math.round(p.value),
      p95: Math.round(p95Map.get(tsMs) ?? 0),
    };
  });
}

export function useLatencyMetrics() {
  const client = useMastraClient();
  const { filters, filterKey } = useMetricsFilters();

  return useQuery({
    queryKey: ['metrics', 'latency', filterKey],
    queryFn: async () => {
      const [agentData, workflowData, toolData] = await Promise.all([
        fetchPercentiles(client, 'mastra_agent_duration_ms', filters),
        fetchPercentiles(client, 'mastra_workflow_duration_ms', filters),
        fetchPercentiles(client, 'mastra_tool_duration_ms', filters),
      ]);
      return { agentData, workflowData, toolData, interval: LATENCY_INTERVAL };
    },
  });
}
