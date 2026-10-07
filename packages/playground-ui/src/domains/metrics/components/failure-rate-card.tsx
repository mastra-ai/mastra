import { EntityType } from '@mastra/core/observability';
import type { TimeRange } from '../drilldown';
import { useMetricsActivity } from '../hooks/use-metrics-activity';
import { useMetricsFilters } from '../hooks/use-metrics-filters';
import { EDGE_BUCKET_AXIS } from '../lib/chart-axis';
import { CHART_COLORS } from '../lib/chart-colors';
import { formatPercent } from '../lib/chart-format';
import { bucketPlan, bucketWindow } from '../lib/metrics-buckets';
import { OpenErrorsInLogsButton } from './card-action-buttons';
import { ChartArea } from './chart-area';
import { ChartCard } from './chart-card';
import { MetricsLineChart } from '@/ds/components/MetricsLineChart';

const SERIES = [{ dataKey: 'failureRate', label: 'Failed runs', color: CHART_COLORS.error }];

const axisPercent = (ratio: number) => `${Math.round(ratio * 100)}%`;

/** Share of agent runs that failed, per bucket; a point opens the failed runs' traces. */
export type FailureRateCardProps = {
  /** Called from the "View errors in Logs" button. */
  onViewErrors?: () => void;
  /** Called with the time range of the clicked bar or point. */
  onTimeRangeClick?: (range: TimeRange) => void;
};

export function FailureRateCard({ onViewErrors, onTimeRangeClick }: FailureRateCardProps) {
  const { data = [], isLoading, isError, isPlaceholderData } = useMetricsActivity();
  const { timestamp } = useMetricsFilters();
  const { stepHours } = bucketPlan(timestamp.start, timestamp.end);
  const runs = data.reduce((sum, b) => sum + b.completed + b.failed, 0);
  const failed = data.reduce((sum, b) => sum + b.failed, 0);

  return (
    <ChartCard
      title="Failure rate"
      description="Share of agent runs that failed."
      summary={{ value: formatPercent(runs > 0 ? failed / runs : 0), label: 'failed' }}
      actions={onViewErrors && <OpenErrorsInLogsButton onClick={onViewErrors} />}
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
          onBucketClick={onTimeRangeClick && (row => onTimeRangeClick(bucketWindow(Number(row.ts), stepHours)))}
          isLoading={isLoading}
          {...EDGE_BUCKET_AXIS}
        />
      </ChartArea>
    </ChartCard>
  );
}
