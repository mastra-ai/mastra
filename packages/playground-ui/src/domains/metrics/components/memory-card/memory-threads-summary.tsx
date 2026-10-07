import { useTopActiveThreadsMetrics } from '@mastra/react/hooks/metrics';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';
import { useMetricsFilters } from '../../hooks/use-metrics-filters';

/** Total runs across the listed threads. Shares the threads panel query. */
export function MemoryThreadsSummary() {
  const { data } = useTopActiveThreadsMetrics(useMetricsFilters());
  if (!data || data.length === 0) return undefined;

  const total = data.reduce((sum, row) => sum + row.runs, 0);
  return <MetricsCard.Summary value={total.toLocaleString()} label="Total runs" />;
}
