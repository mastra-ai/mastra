import { useTopActiveThreadsMetrics } from '@mastra/react/hooks/metrics';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';
import type { DrilldownScope } from '../../drilldown';
import { useMetricsFilters } from '../../hooks/use-metrics-filters';
import { MetricsTableSkeleton } from '../metrics-table-skeleton';
import { threadScope } from './memory-card.utils';
import { MemoryThreadsTable } from './memory-threads-table';

export interface MemoryThreadsPanelProps {
  onThreadClick?: (scope: DrilldownScope) => void;
}

export function MemoryThreadsPanel({ onThreadClick }: MemoryThreadsPanelProps) {
  const { data, isLoading, isError } = useTopActiveThreadsMetrics(useMetricsFilters());

  if (isLoading) return <MetricsTableSkeleton label="Loading threads" />;
  if (isError || !data) return <MetricsCard.Error message="Failed to load memory data" className="h-56" />;

  return (
    <MemoryThreadsTable rows={data} onRowClick={onThreadClick ? row => onThreadClick(threadScope(row)) : undefined} />
  );
}
