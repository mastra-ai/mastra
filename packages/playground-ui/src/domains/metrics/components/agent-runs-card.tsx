import { EntityType } from '@mastra/core/observability';
import { useBucketTracesNav } from '../hooks/use-bucket-traces-nav';
import { useMetricsActivity } from '../hooks/use-metrics-activity';
import { EDGE_BUCKET_AXIS } from '../lib/chart-axis';
import { CHART_COLORS } from '../lib/chart-colors';
import { formatCount } from '../lib/chart-format';
import { ChartArea } from './chart-area';
import { ChartCard } from './chart-card';
import { MetricsStackedBarChart } from '@/ds/components/MetricsStackedBarChart';

const SERIES = [
  { dataKey: 'completed', label: 'Completed', color: CHART_COLORS.green },
  { dataKey: 'failed', label: 'Failed', color: CHART_COLORS.error },
];

/** Completed and failed agent runs per bucket; a column opens its agent traces. */
export function AgentRunsCard() {
  const { data = [], isLoading, isError, isPlaceholderData } = useMetricsActivity();
  const openBucket = useBucketTracesNav()({ rootEntityType: EntityType.AGENT });
  const total = data.reduce((sum, b) => sum + b.completed + b.failed, 0);

  return (
    <ChartCard
      title="Agent runs"
      description="Completed and failed runs."
      summary={{ value: formatCount(total), label: 'runs' }}
      isLoading={isLoading}
      isUpdating={isPlaceholderData}
      isError={isError}
    >
      <ChartArea isError={isError} isEmpty={!isLoading && total === 0} emptyMessage="No agent runs in this range.">
        <MetricsStackedBarChart
          data={data}
          series={SERIES}
          height="fill"
          xLabels="edges"
          showYAxis={false}
          valueFormatter={formatCount}
          onBucketClick={openBucket}
          isLoading={isLoading}
          {...EDGE_BUCKET_AXIS}
        />
      </ChartArea>
    </ChartCard>
  );
}
