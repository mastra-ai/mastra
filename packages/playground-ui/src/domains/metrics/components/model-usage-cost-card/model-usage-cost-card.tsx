import { useModelUsageCostMetrics } from '@mastra/react/hooks/metrics';
import { MetricsCard } from '../../../../ds/components/MetricsCard/metrics-card';
import type { DrilldownScope } from '../../drilldown';
import { useMetricsFilters } from '../../hooks/use-metrics-filters';
import { OpenInTracesButton } from '../card-action-buttons';
import { MetricsTableSkeleton } from '../metrics-table-skeleton';
import { ModelUsageCostCardContent } from './model-usage-cost-card-content';
import { ModelUsageCostCardLayout } from './model-usage-cost-card-layout';
import { formatTotalCost, modelUsageRowScope, modelUsageTracesScope } from './model-usage-cost-card.utils';

export interface ModelUsageCostCardProps {
  /** Opens agent traces. No handler, no button. */
  onOpenTraces?: (scope: DrilldownScope) => void;
  /** Opens agent traces for a clicked model. No handler, rows are not clickable. */
  onRowClick?: (scope: DrilldownScope) => void;
}

export function ModelUsageCostCard({ onOpenTraces, onRowClick }: ModelUsageCostCardProps) {
  const { data, isLoading, isError } = useModelUsageCostMetrics(useMetricsFilters());
  const actions = onOpenTraces ? <OpenInTracesButton onClick={() => onOpenTraces(modelUsageTracesScope)} /> : undefined;

  if (isLoading) {
    return (
      <ModelUsageCostCardLayout actions={actions} summary={<MetricsCard.Summary value="—" label="Total cost" />}>
        <MetricsTableSkeleton label="Loading model usage" />
      </ModelUsageCostCardLayout>
    );
  }

  if (isError || !data) {
    return (
      <ModelUsageCostCardLayout actions={actions}>
        <MetricsCard.Error message="Failed to load model usage data" className="h-64" />
      </ModelUsageCostCardLayout>
    );
  }

  return (
    <ModelUsageCostCardLayout
      actions={actions}
      summary={data.length > 0 ? <MetricsCard.Summary value={formatTotalCost(data)} label="Total cost" /> : undefined}
    >
      <ModelUsageCostCardContent
        rows={data}
        onRowClick={onRowClick ? row => onRowClick(modelUsageRowScope(row)) : undefined}
      />
    </ModelUsageCostCardLayout>
  );
}
