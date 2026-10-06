import { EntityType } from '@mastra/core/observability';
import { useBucketTracesNav } from '../hooks/use-bucket-traces-nav';
import { useDrilldown } from '../hooks/use-drilldown';
import { useMetricsActivity } from '../hooks/use-metrics-activity';
import { EDGE_BUCKET_AXIS } from '../lib/chart-axis';
import { CHART_COLORS } from '../lib/chart-colors';
import { formatPercent } from '../lib/chart-format';
import { OpenErrorsInLogsButton } from './card-action-buttons';
import { ChartArea } from './chart-area';
import { ChartCard } from './chart-card';
import { MetricsLineChart } from '@/ds/components/MetricsLineChart';
import { useLinkComponent } from '@/lib/framework';

const SERIES = [{ dataKey: 'failureRate', label: 'Failed runs', color: CHART_COLORS.error }];

const axisPercent = (ratio: number) => `${Math.round(ratio * 100)}%`;

/** Share of agent runs that failed, per bucket; a point opens the failed runs' traces. */
export function FailureRateCard() {
  const { Link } = useLinkComponent();
  const { data = [], isLoading, isError, isPlaceholderData } = useMetricsActivity();
  const { getLogsHref } = useDrilldown();
  const openBucket = useBucketTracesNav()({ rootEntityType: EntityType.AGENT, status: 'error' });
  const runs = data.reduce((sum, b) => sum + b.completed + b.failed, 0);
  const failed = data.reduce((sum, b) => sum + b.failed, 0);

  return (
    <ChartCard
      title="Failure rate"
      description="Share of agent runs that failed."
      summary={{ value: formatPercent(runs > 0 ? failed / runs : 0), label: 'failed' }}
      actions={<OpenErrorsInLogsButton href={getLogsHref({ status: 'error' })} LinkComponent={Link} />}
      isLoading={isLoading}
      isUpdating={isPlaceholderData}
      isError={isError}
    >
      <ChartArea isError={isError} isEmpty={!isLoading && runs === 0} emptyMessage="No agent runs in this range.">
        <MetricsLineChart
          data={data}
          series={SERIES}
          height="fill"
          xLabels="edges"
          showYAxis={false}
          valueFormatter={formatPercent}
          axisFormatter={axisPercent}
          onBucketClick={openBucket}
          isLoading={isLoading}
          {...EDGE_BUCKET_AXIS}
        />
      </ChartArea>
    </ChartCard>
  );
}
