import { MetricsCard } from '@/ds/components/MetricsCard';
import { MetricsDataTable } from '@/ds/components/DashboardDataTable/dashboard-data-table';
import { useModelUsageCostMetrics } from '../hooks/use-model-usage-cost-metrics';

export function ModelUsageCostCard() {
  const { data: rows, isLoading } = useModelUsageCostMetrics();
  const hasData = !!rows && rows.length > 0;

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Model Usage & Cost" description="Token consumption by model." />
        {hasData && <MetricsCard.Summary value="—" label="Total cost" />}
      </MetricsCard.TopBar>
      {isLoading ? (
        <MetricsCard.Loading />
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
                { label: 'Cost', value: () => '—', highlight: true },
              ]}
              data={rows.map(row => ({ ...row, key: row.model }))}
            />
          )}
        </MetricsCard.Content>
      )}
    </MetricsCard>
  );
}
