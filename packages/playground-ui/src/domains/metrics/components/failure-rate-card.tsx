import type { TimeRange } from '../drilldown';
import { useMetricsActivity } from '../hooks/use-metrics-activity';
import type { ActivityBucket } from '../hooks/use-metrics-activity';
import { useMetricsFilters } from '../hooks/use-metrics-filters';
import { FAILURE_RATE_SERIES, failureRateTotal, runTotals } from '../lib/agent-runs';
import { EDGE_BUCKET_AXIS } from '../lib/chart-axis';
import { formatPercent } from '../lib/chart-format';
import { bucketPlan, bucketWindow } from '../lib/metrics-buckets';
import { OpenErrorsInLogsButton } from './card-action-buttons';
import { ChartArea } from './chart-area';
import { ChartCard } from './chart-card';
import { ChartCardError } from './chart-card-error';
import { MetricsCard } from '@/ds/components/MetricsCard';
import { MetricsLineChart, MetricsLineChartLegend } from '@/ds/components/MetricsLineChart';

const axisPercent = (ratio: number) => `${Math.round(ratio * 100)}%`;

/**
 * The share of agent runs that failed, per bucket, as a line; a point opens that bucket's time range.
 * `FailureRateCard`'s chart, and the Agent runs card's Failure rate tab.
 */
export function FailureRateChart({
  data,
  stepHours,
  isLoading,
  onTimeRangeClick,
}: {
  data: ActivityBucket[];
  /** Each bucket's length, for the time range a point opens. */
  stepHours: number;
  isLoading: boolean;
  onTimeRangeClick?: (range: TimeRange) => void;
}) {
  // With nothing failed, the axis would fall back to 0-4 (400%); a share tops out at 100%.
  const yDomain: [number, number] | undefined = runTotals(data).failed === 0 ? [0, 1] : undefined;
  return (
    <MetricsLineChart
      lineStyle="thin"
      data={data}
      series={FAILURE_RATE_SERIES}
      height="fill"
      xLabels="edges"
      showLegend={false}
      valueFormatter={formatPercent}
      axisFormatter={axisPercent}
      yDomain={yDomain}
      onBucketClick={onTimeRangeClick && (row => onTimeRangeClick(bucketWindow(Number(row.ts), stepHours)))}
      isLoading={isLoading}
      {...EDGE_BUCKET_AXIS}
    />
  );
}

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

  const layout = {
    title: 'Failure rate',
    actions: onViewErrors && <OpenErrorsInLogsButton onClick={onViewErrors} />,
    toolbar: (
      <MetricsCard.Toolbar>
        <MetricsLineChartLegend series={FAILURE_RATE_SERIES} />
      </MetricsCard.Toolbar>
    ),
  };

  if (isError) {
    return (
      <ChartCard {...layout}>
        <ChartCardError />
      </ChartCard>
    );
  }

  return (
    <ChartCard {...layout} total={failureRateTotal(data)} isLoading={isLoading} isUpdating={isPlaceholderData}>
      <ChartArea isEmpty={!isLoading && runTotals(data).runs === 0}>
        <FailureRateChart data={data} stepHours={stepHours} isLoading={isLoading} onTimeRangeClick={onTimeRangeClick} />
      </ChartArea>
    </ChartCard>
  );
}
