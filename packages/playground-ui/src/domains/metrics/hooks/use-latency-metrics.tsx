import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMetricsFilters } from './use-metrics-filters';

export interface LatencyPoint {
  [key: string]: unknown;
  time: string;
  p50: number;
  p95: number;
}

async function fetchPercentiles(
  client: ReturnType<typeof useMastraClient>,
  metricName: string,
  timestamp: { start: Date; end: Date },
): Promise<LatencyPoint[]> {
  const res = await client.getMetricPercentiles({
    name: metricName,
    percentiles: [0.5, 0.95],
    interval: '1h',
    filters: { timestamp },
  });

  const p50Series = res.series.find(s => s.percentile === 0.5);
  const p95Series = res.series.find(s => s.percentile === 0.95);

  if (!p50Series || !p95Series) return [];

  const p95Map = new Map(p95Series.points.map(p => [new Date(p.timestamp).getTime(), p.value]));

  return p50Series.points.map(p => {
    const ts = new Date(p.timestamp);
    return {
      time: ts.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      p50: Math.round(p.value),
      p95: Math.round(p95Map.get(ts.getTime()) ?? 0),
    };
  });
}

export function useLatencyMetrics() {
  const client = useMastraClient();
  const { datePreset, customRange, timestamp } = useMetricsFilters();

  return useQuery({
    queryKey: ['metrics', 'latency', datePreset, customRange],
    queryFn: async () => {
      const [agentData, workflowData, toolData] = await Promise.all([
        fetchPercentiles(client, 'mastra_agent_duration_ms', timestamp),
        fetchPercentiles(client, 'mastra_workflow_duration_ms', timestamp),
        fetchPercentiles(client, 'mastra_tool_duration_ms', timestamp),
      ]);
      return { agentData, workflowData, toolData };
    },
  });
}
