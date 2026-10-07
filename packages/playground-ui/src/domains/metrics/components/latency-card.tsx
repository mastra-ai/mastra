import { EntityType } from '@mastra/core/observability';
import { useState } from 'react';
import { useBucketTracesNav } from '../hooks/use-bucket-traces-nav';
import { useDrilldown } from '../hooks/use-drilldown';
import { useMetricsFilters } from '../hooks/use-metrics-filters';
import type { LatencyEntity } from '../hooks/use-metrics-latency';
import { useMetricsLatency } from '../hooks/use-metrics-latency';
import { EDGE_BUCKET_AXIS } from '../lib/chart-axis';
import { CHART_COLORS } from '../lib/chart-colors';
import { formatAxisDuration, formatDuration } from '../lib/chart-format';
import { bucketPlan, intervalHours } from '../lib/metrics-buckets';
import { OpenInTracesButton } from './card-action-buttons';
import { ChartArea } from './chart-area';
import { ChartCard } from './chart-card';
import { MetricsCard } from '@/ds/components/MetricsCard';
import type { MetricsLineChartSeries } from '@/ds/components/MetricsLineChart';
import { MetricsLineChart, MetricsLineChartLegend } from '@/ds/components/MetricsLineChart';
import { useLinkComponent } from '@/lib/framework';

const ROOT_ENTITY: Record<LatencyEntity, EntityType> = {
  agents: EntityType.AGENT,
  workflows: EntityType.WORKFLOW_RUN,
  tools: EntityType.TOOL,
};

function seriesFor(entity: LatencyEntity): MetricsLineChartSeries[] {
  return [
    { dataKey: `${entity}P50`, label: 'P50', color: CHART_COLORS.sky },
    { dataKey: `${entity}P95`, label: 'P95', color: CHART_COLORS.green, emphasis: true },
  ];
}

const EMPTY_NOUN: Record<LatencyEntity, string> = {
  agents: 'agent runs',
  workflows: 'workflow runs',
  tools: 'tool calls',
};

/** P50 and P95 durations of agent runs, workflow runs or tool calls; a point opens its traces. */
export function LatencyCard() {
  const [entity, setEntity] = useState<LatencyEntity>('agents');
  const { data = [], isLoading, isError, isPlaceholderData } = useMetricsLatency();
  const { timestamp } = useMetricsFilters();
  const { getTracesHref } = useDrilldown();
  const { Link } = useLinkComponent();
  // The latency chart keeps the API's 1h or 1d buckets, so a point opens that window.
  const step = intervalHours(bucketPlan(timestamp.start, timestamp.end).interval);
  const openBucket = useBucketTracesNav(step)({ rootEntityType: ROOT_ENTITY[entity] });
  const series = seriesFor(entity);
  const peak = Math.max(0, ...data.map(b => b[`${entity}P95`] ?? 0));

  return (
    <ChartCard
      title="Latency"
      description="Duration percentiles."
      summary={{ value: peak > 0 ? formatDuration(peak) : '—', label: 'peak P95' }}
      actions={
        <OpenInTracesButton href={getTracesHref({ rootEntityType: ROOT_ENTITY[entity] })} LinkComponent={Link} />
      }
      isLoading={isLoading}
      isUpdating={isPlaceholderData}
      isError={isError}
    >
      <MetricsCard.Toolbar>
        <MetricsLineChartLegend series={series} />
        <MetricsCard.Tabs<LatencyEntity> value={entity} onValueChange={setEntity}>
          <MetricsCard.Tab value="agents">Agents</MetricsCard.Tab>
          <MetricsCard.Tab value="workflows">Workflows</MetricsCard.Tab>
          <MetricsCard.Tab value="tools">Tools</MetricsCard.Tab>
        </MetricsCard.Tabs>
      </MetricsCard.Toolbar>
      <ChartArea
        isError={isError}
        isEmpty={!isLoading && peak === 0}
        emptyMessage={`No ${EMPTY_NOUN[entity]} in this range.`}
      >
        <MetricsLineChart
          data={data}
          series={series}
          height="fill"
          xLabels="edges"
          showLegend={false}
          showYAxis={false}
          valueFormatter={formatDuration}
          axisFormatter={formatAxisDuration}
          onBucketClick={openBucket}
          isLoading={isLoading}
          {...EDGE_BUCKET_AXIS}
        />
      </ChartArea>
    </ChartCard>
  );
}
