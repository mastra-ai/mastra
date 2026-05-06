import { MetricsCard } from '../../../ds/components/MetricsCard';
import { MetricsDataTable } from '../../../ds/components/MetricsDataTable';
import type { ModelUsageRow } from '../hooks/use-model-usage-cost-metrics';
import { formatCost } from './metrics-utils';

export interface ModelUsageCostCardViewProps {
  rows: ModelUsageRow[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function ModelUsageCostCardView({ rows, isLoading, isError }: ModelUsageCostCardViewProps) {
  const hasData = !!rows && rows.length > 0;

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Model Usage & Cost" description="Token consumption by model." />
        {hasData &&
          (() => {
            const totalCost = rows.reduce((sum, r) => sum + (r.cost ?? 0), 0);
            const units = new Set(rows.filter(r => r.cost != null && r.costUnit).map(r => r.costUnit as string));
            let value: string;
            if (units.size === 0) {
              value = totalCost > 0 ? formatCost(totalCost) : '—';
            } else if (units.size === 1) {
              value = totalCost > 0 ? formatCost(totalCost, [...units][0]) : '—';
            } else {
              value = 'Mixed';
            }
            return <MetricsCard.Summary value={value} label="Total cost" />;
          })()}
      </MetricsCard.TopBar>
      {isLoading ? (
        <MetricsCard.Loading />
      ) : isError ? (
        <MetricsCard.Error message="Failed to load model usage data" />
      ) : (
        <MetricsCard.Content>
          {!hasData ? (
            <MetricsCard.NoData message="No model usage data yet" />
          ) : (
            <MetricsDataTable
              columns={[
                { label: 'Model', value: row => row.model },
                { label: 'Input', value: row => row.input },
                { label: 'Output', value: row => row.output },
                { label: 'Cache Read', value: row => row.cacheRead },
                { label: 'Cache Write', value: row => row.cacheWrite },
                {
                  label: 'Cost',
                  value: row => (row.cost != null ? formatCost(row.cost, row.costUnit) : '—'),
                  highlight: true,
                },
              ]}
              data={rows.map(row => ({ ...row, key: row.model }))}
            />
          )}
        </MetricsCard.Content>
      )}
    </MetricsCard>
  );
}
