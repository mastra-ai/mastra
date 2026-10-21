import type { AggregateTracesArgs } from '@mastra/client-js';
import { EntityType, SpanType } from '@mastra/core/observability';
import { useState } from 'react';
import type { DrilldownScope } from '../drilldown';
import { useMetricsTraceAggregate } from '../hooks/use-metrics-trace-aggregate';
import type { TraceAggregateScope } from '../hooks/use-metrics-trace-aggregate';
import { EDGE_BUCKET_AXIS } from '../lib/chart-axis';
import { CHART_COLORS } from '../lib/chart-colors';
import { formatAxisDuration, formatDuration } from '../lib/chart-format';
import { bucketWindow, intervalHours } from '../lib/metrics-buckets';
import { bucketTraceAggregateRows, TRACE_AGGREGATE_SERIES_LIMIT } from '../lib/trace-aggregate';
import { OpenInTracesButton } from './card-action-buttons';
import { ChartArea } from './chart-area';
import { ChartCard } from './chart-card';
import { ChartCardError } from './chart-card-error';
import { TraceAggregateCard } from './trace-aggregate-card';
import { MetricsCard } from '@/ds/components/MetricsCard';
import { MetricsLineChart, MetricsLineChartLegend } from '@/ds/components/MetricsLineChart';
import type { MetricsLineChartSeries } from '@/ds/components/MetricsLineChart';

type RootType = 'agents' | 'workflows';

const ROOT_SPAN_TYPE: Record<RootType, SpanType> = {
  agents: SpanType.AGENT_RUN,
  workflows: SpanType.WORKFLOW_RUN,
};

const ROOT_ENTITY_TYPE: Record<RootType, EntityType> = {
  agents: EntityType.AGENT,
  workflows: EntityType.WORKFLOW_RUN,
};

const EMPTY_NOUN: Record<RootType, string> = { agents: 'agent', workflows: 'workflow' };

const SERIES: MetricsLineChartSeries[] = [
  { dataKey: 'p50', label: 'P50', color: CHART_COLORS.sky },
  { dataKey: 'p90', label: 'P90', color: CHART_COLORS.green, emphasis: true },
  { dataKey: 'p99', label: 'P99', color: CHART_COLORS.violet },
];

const TITLE = 'Trace latency';
const DESCRIPTION = 'Duration percentiles of traces, by what started them.';

export type TraceLatencyCardProps = {
  /** Called from the "View in Traces" button with the root type of the open tab. */
  onViewTraces?: (scope: DrilldownScope) => void;
  /** Called with the root type and time range of the clicked point. */
  onPointClick?: (scope: DrilldownScope) => void;
};

/** P50, P90 and P99 durations of traces started by an agent or a workflow, over the range. */
export function TraceLatencyCard(props: TraceLatencyCardProps) {
  return (
    <TraceAggregateCard title={TITLE} description={DESCRIPTION} requiresRootSpanFields>
      {scope => <TraceLatencyChart scope={scope} {...props} />}
    </TraceAggregateCard>
  );
}

function TraceLatencyChart({
  scope,
  onViewTraces,
  onPointClick,
}: TraceLatencyCardProps & { scope: TraceAggregateScope }) {
  const [rootType, setRootType] = useState<RootType>('agents');
  const request: AggregateTracesArgs = {
    timeRange: scope.timeRange,
    where: scope.where,
    interval: scope.interval,
    groupBy: ['spanType'],
    measures: ['duration.p50', 'duration.p90', 'duration.p99'],
    limit: TRACE_AGGREGATE_SERIES_LIMIT,
  };
  const { data, isLoading, isPlaceholderData, error, refetch } = useMetricsTraceAggregate(request);

  const spanType = ROOT_SPAN_TYPE[rootType];
  const chart = bucketTraceAggregateRows(data?.rows ?? [], scope.window).map(({ rows, ...labels }) => {
    const measures = rows.find(row => row.dimensions?.spanType === spanType)?.measures;
    return {
      ...labels,
      p50: measures?.['duration.p50'] ?? undefined,
      p90: measures?.['duration.p90'] ?? undefined,
      p99: measures?.['duration.p99'] ?? undefined,
    };
  });
  const peak = Math.max(0, ...chart.map(bucket => bucket.p90 ?? 0));
  const step = intervalHours(scope.interval === '1d' ? '1d' : '1h');

  const layout = {
    title: TITLE,
    description: DESCRIPTION,
    actions: onViewTraces && (
      <OpenInTracesButton onClick={() => onViewTraces({ rootEntityType: ROOT_ENTITY_TYPE[rootType] })} />
    ),
    toolbar: (
      <MetricsCard.Toolbar>
        <MetricsLineChartLegend series={SERIES} />
        <MetricsCard.Tabs<RootType> value={rootType} onValueChange={setRootType}>
          <MetricsCard.Tab value="agents">Agents</MetricsCard.Tab>
          <MetricsCard.Tab value="workflows">Workflows</MetricsCard.Tab>
        </MetricsCard.Tabs>
      </MetricsCard.Toolbar>
    ),
  };

  if (error) {
    return (
      <ChartCard {...layout}>
        <ChartCardError error={error} onRetry={() => void refetch()} />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      {...layout}
      summary={
        <MetricsCard.Summary value={peak > 0 ? formatDuration(peak) : '—'} label="peak P90" isLoading={isLoading} />
      }
      isUpdating={isPlaceholderData}
    >
      <ChartArea isEmpty={!isLoading && peak === 0} emptyMessage={`No ${EMPTY_NOUN[rootType]} traces in this range.`}>
        <MetricsLineChart
          data={chart}
          series={SERIES}
          height="fill"
          xLabels="edges"
          showLegend={false}
          valueFormatter={formatDuration}
          axisFormatter={formatAxisDuration}
          onBucketClick={
            onPointClick &&
            (row =>
              onPointClick({
                rootEntityType: ROOT_ENTITY_TYPE[rootType],
                window: bucketWindow(Number(row.ts), step),
              }))
          }
          isLoading={isLoading}
          {...EDGE_BUCKET_AXIS}
        />
      </ChartArea>
    </ChartCard>
  );
}
