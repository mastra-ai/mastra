import { useState } from 'react';
import type { TimeRange } from '../drilldown';
import { useMetricsActivity } from '../hooks/use-metrics-activity';
import { useMetricsFilters } from '../hooks/use-metrics-filters';
import { FAILURE_RATE_SERIES, failureRateTotal, runTotals } from '../lib/agent-runs';
import { EDGE_BUCKET_AXIS } from '../lib/chart-axis';
import { CHART_COLORS } from '../lib/chart-colors';
import { formatCount } from '../lib/chart-format';
import { bucketPlan, bucketWindow } from '../lib/metrics-buckets';
import { OpenErrorsInLogsButton } from './card-action-buttons';
import { ChartArea } from './chart-area';
import { ChartCard } from './chart-card';
import { ChartCardError } from './chart-card-error';
import { FailureRateChart } from './failure-rate-card';
import { MetricsCard } from '@/ds/components/MetricsCard';
import { MetricsLineChartLegend } from '@/ds/components/MetricsLineChart';
import { MetricsStackedBarChart } from '@/ds/components/MetricsStackedBarChart';

const SERIES = [
  { dataKey: 'completed', label: 'Completed', color: CHART_COLORS.green },
  { dataKey: 'failed', label: 'Failed', color: CHART_COLORS.error },
];

type View = 'runs' | 'failure';

const VIEWS = [
  { value: 'runs', label: 'Agent runs' },
  { value: 'failure', label: 'Failure rate' },
] as const satisfies readonly { value: View; label: string }[];

/**
 * Completed and failed agent runs per bucket, or the share that failed; tabs under the title switch
 * between them. A column or point opens its agent traces.
 */
export type AgentRunsCardProps = {
  /** Called with the time range of the clicked column (Agent runs). */
  onTimeRangeClick?: (range: TimeRange) => void;
  /** Called with the time range of the clicked point (Failure rate), for its failed runs. */
  onFailureTimeRangeClick?: (range: TimeRange) => void;
  /** Called from the "View errors in logs" button (Failure rate). */
  onViewErrors?: () => void;
};

/**
 * Both views chart the same buckets, so one card holds them: switching keeps the card, its tabs and
 * its data, and swaps only the chart, as the Latency and Token usage cards do.
 */
export function AgentRunsCard({ onTimeRangeClick, onFailureTimeRangeClick, onViewErrors }: AgentRunsCardProps) {
  const [view, setView] = useState<View>('runs');
  const { data = [], isLoading, isError, isPlaceholderData } = useMetricsActivity();
  const { timestamp } = useMetricsFilters();
  const { stepHours } = bucketPlan(timestamp.start, timestamp.end);
  const { runs } = runTotals(data);
  const failure = view === 'failure';

  const layout = {
    title: 'Agent runs',
    tabs: { value: view, onValueChange: setView, options: VIEWS },
    actions: failure && onViewErrors ? <OpenErrorsInLogsButton onClick={onViewErrors} /> : undefined,
    toolbar: (
      <MetricsCard.Toolbar>
        <MetricsLineChartLegend series={failure ? FAILURE_RATE_SERIES : SERIES} />
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
    <ChartCard
      {...layout}
      total={failure ? failureRateTotal(data) : formatCount(runs)}
      isLoading={isLoading}
      isUpdating={isPlaceholderData}
    >
      <ChartArea isEmpty={!isLoading && runs === 0}>
        {failure ? (
          <FailureRateChart
            data={data}
            stepHours={stepHours}
            isLoading={isLoading}
            onTimeRangeClick={onFailureTimeRangeClick}
          />
        ) : (
          <MetricsStackedBarChart
            data={data}
            series={SERIES}
            height="fill"
            xLabels="edges"
            showLegend={false}
            valueFormatter={formatCount}
            onBucketClick={onTimeRangeClick && (row => onTimeRangeClick(bucketWindow(Number(row.ts), stepHours)))}
            isLoading={isLoading}
            {...EDGE_BUCKET_AXIS}
          />
        )}
      </ChartArea>
    </ChartCard>
  );
}
