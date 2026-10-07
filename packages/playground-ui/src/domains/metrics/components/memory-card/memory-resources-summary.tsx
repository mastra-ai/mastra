import { useTopResourcesByThreadsMetrics } from '@mastra/react/hooks/metrics';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';
import { useMetricsFilters } from '../../hooks/use-metrics-filters';

/** Total threads across the listed resources. Shares the resources panel query. */
export function MemoryResourcesSummary() {
  const { data } = useTopResourcesByThreadsMetrics(useMetricsFilters());
  if (!data || data.length === 0) return undefined;

  const total = data.reduce((sum, row) => sum + row.threadCount, 0);
  return <MetricsCard.Summary value={total.toLocaleString()} label="Total threads" />;
}
