import { MetricsCard, MetricsDataTable } from '@mastra/playground-ui';
import { useModelUsageCostMetrics } from '../hooks/use-model-usage-cost-metrics';
import { formatCost } from './metrics-utils';

export function ModelUsageCostCard() {
  const { data: rows, isLoading, isError } = useModelUsageCostMetrics();
  const hasData = !!rows && rows.length > 0;

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Model Usage & Cost" description="Token consumption by model." />
        {hasData &&
          (() => {
            const totalCost = rows.reduce((sum, r) => sum + (r.cost ?? 0), 0);
            const unit = rows.find(r => r.costUnit)?.costUnit;
            return <MetricsCard.Summary value={totalCost > 0 ? formatCost(totalCost, unit) : '—'} label="Total cost" />;
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
