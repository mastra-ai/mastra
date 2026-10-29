import type { AggregateTracesArgs } from '@mastra/client-js';
import type { DrilldownScope } from '../../drilldown';
import { useMetricsTraceAggregate } from '../../hooks/use-metrics-trace-aggregate';
import type { TraceAggregateScope } from '../../hooks/use-metrics-trace-aggregate';
import { EDGE_BUCKET_AXIS } from '../../lib/chart-axis';
import { CHART_COLORS } from '../../lib/chart-colors';
import { formatAxisCount, formatCount } from '../../lib/chart-format';
import { bucketWindow, intervalHours } from '../../lib/metrics-buckets';
import { bucketTraceAggregateRows, TRACE_AGGREGATE_SERIES_LIMIT } from '../../lib/trace-aggregate';
import type { TraceAggregateRow } from '../../lib/trace-aggregate';
import { ChartArea } from '../chart-area';
import { ChartCard } from '../chart-card';
import { ChartCardError } from '../chart-card-error';
import { MetricsCard } from '@/ds/components/MetricsCard';
import { MetricsLineChart, MetricsLineChartLegend } from '@/ds/components/MetricsLineChart';
import type { MetricsLineChartSeries } from '@/ds/components/MetricsLineChart';

/** Most apps set resource and thread ids (through memory); few set user and session ids. */
const IDS = [
  { measure: 'countDistinct.resourceId', dataKey: 'resources', label: 'Resources', color: CHART_COLORS.sky },
  { measure: 'countDistinct.threadId', dataKey: 'threads', label: 'Threads', color: CHART_COLORS.green },
  { measure: 'countDistinct.userId', dataKey: 'users', label: 'Users', color: CHART_COLORS.violet },
  { measure: 'countDistinct.sessionId', dataKey: 'sessions', label: 'Sessions', color: CHART_COLORS.teal },
] as const;

type Id = (typeof IDS)[number];

const MEASURES: AggregateTracesArgs['measures'] = IDS.map(id => id.measure);

export const DISTINCT_IDS_TITLE = 'Resources and threads';
export const DISTINCT_IDS_DESCRIPTION = 'Unique ids on traces; users and sessions only when set.';

export type DistinctIdsChartProps = {
  scope: TraceAggregateScope;
  /** Called with the time range of the clicked bucket. */
  onTimeRangeClick?: (scope: DrilldownScope) => void;
};

function count(row: TraceAggregateRow | undefined, id: Id) {
  return row?.measures[id.measure] ?? 0;
}

/** Distinct ids per bucket, with range totals from a second request. */
export function DistinctIdsChart({ scope, onTimeRangeClick }: DistinctIdsChartProps) {
  const series = useMetricsTraceAggregate({
    timeRange: scope.timeRange,
    where: scope.where,
    interval: scope.interval,
    measures: MEASURES,
    limit: TRACE_AGGREGATE_SERIES_LIMIT,
  });
  // Bucket counts can't be added up: an id active in two buckets would count twice.
  const totals = useMetricsTraceAggregate({ timeRange: scope.timeRange, where: scope.where, measures: MEASURES });

  const total = totals.data?.rows[0];
  // Only the ids this project sets get a line; the rest would sit flat at zero.
  const shown = IDS.filter(id => count(total, id) > 0);
  // The legend carries each id's range total, as the Scores legend carries each scorer's mean.
  const lines: MetricsLineChartSeries[] = shown.map((id, i) => ({
    dataKey: id.dataKey,
    label: id.label,
    color: id.color,
    emphasis: i === 0,
    aggregate: () => ({ value: formatCount(count(total, id)) }),
  }));
  const chart = bucketTraceAggregateRows(series.data?.rows ?? [], scope.window).map(({ rows, ...labels }) => ({
    ...labels,
    ...Object.fromEntries(shown.map(id => [id.dataKey, count(rows[0], id)])),
  }));
  const step = intervalHours(scope.interval === '1d' ? '1d' : '1h');
  const error = series.error ?? totals.error;
  const isLoading = series.isLoading || totals.isLoading;

  const layout = {
    title: DISTINCT_IDS_TITLE,
    description: DISTINCT_IDS_DESCRIPTION,
    toolbar: lines.length > 0 && (
      <MetricsCard.Toolbar>
        <MetricsLineChartLegend data={chart} series={lines} />
      </MetricsCard.Toolbar>
    ),
  };

  if (error) {
    return (
      <ChartCard {...layout}>
        <ChartCardError
          error={error}
          onRetry={() => {
            if (series.error) void series.refetch();
            if (totals.error) void totals.refetch();
          }}
        />
      </ChartCard>
    );
  }

  return (
    <ChartCard {...layout} isUpdating={series.isPlaceholderData || totals.isPlaceholderData}>
      <ChartArea
        isEmpty={!isLoading && shown.length === 0}
        emptyMessage="No traces in this range set a resource, thread, user or session id."
      >
        <MetricsLineChart
          data={chart}
          series={lines}
          height="fill"
          xLabels="edges"
          showLegend={false}
          valueFormatter={formatCount}
          axisFormatter={formatAxisCount}
          onBucketClick={onTimeRangeClick && (row => onTimeRangeClick({ window: bucketWindow(Number(row.ts), step) }))}
          isLoading={isLoading}
          {...EDGE_BUCKET_AXIS}
        />
      </ChartArea>
    </ChartCard>
  );
}
