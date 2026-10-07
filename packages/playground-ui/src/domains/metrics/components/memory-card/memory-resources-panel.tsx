import { useTopResourcesByThreadsMetrics } from '@mastra/react/hooks/metrics';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';
import type { DrilldownScope } from '../../drilldown';
import { useMetricsFilters } from '../../hooks/use-metrics-filters';
import { MetricsTableSkeleton } from '../metrics-table-skeleton';
import { resourceScope } from './memory-card.utils';
import { MemoryResourcesTable } from './memory-resources-table';

export interface MemoryResourcesPanelProps {
  onResourceClick?: (scope: DrilldownScope) => void;
}

export function MemoryResourcesPanel({ onResourceClick }: MemoryResourcesPanelProps) {
  const { data, isLoading, isError } = useTopResourcesByThreadsMetrics(useMetricsFilters());

  if (isLoading) return <MetricsTableSkeleton label="Loading resources" />;
  if (isError || !data) return <MetricsCard.Error message="Failed to load memory data" className="h-56" />;

  return (
    <MemoryResourcesTable
      rows={data}
      onRowClick={onResourceClick ? row => onResourceClick(resourceScope(row)) : undefined}
    />
  );
}
