import { ActionRow } from '@mastra/playground-ui/components/ActionRow';
import { Breadcrumb, Crumb } from '@mastra/playground-ui/components/Breadcrumb';
import {
  DEFAULT_FILTER_OPERATORS,
  FILTER_BAR_TIME_RANGE_FIELD,
  FILTER_BAR_TIME_RANGE_FIELD_ID,
  FILTER_BAR_TIME_RANGE_ITEM,
  FilterBar,
} from '@mastra/playground-ui/components/FilterBar';
import type { FilterBarField, FilterBarItem } from '@mastra/playground-ui/components/FilterBar';
import { MetricsCard } from '@mastra/playground-ui/components/MetricsCard';
import { MetricsCardGroup } from '@mastra/playground-ui/components/MetricsCardGroup';
import { MetricsLineChart, MetricsLineChartLegend } from '@mastra/playground-ui/components/MetricsLineChart';
import type { MetricsLineChartSeries } from '@mastra/playground-ui/components/MetricsLineChart';
import { MetricsStackedBarChart } from '@mastra/playground-ui/components/MetricsStackedBarChart';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { ShareBar } from '@mastra/playground-ui/components/ShareBar';
import { ChartArea, ChartCard, KpiCard, MetricsGrid } from '@mastra/playground-ui/domains/metrics/components';
import { formatCompactNumber, formatCost } from '@mastra/playground-ui/utils/cost';
import { formatDuration } from '@mastra/playground-ui/utils/duration';
import { formatPercent } from '@mastra/playground-ui/utils/number';
import { ActivityIcon, CircleAlertIcon, CoinsIcon, GlobeIcon, RouteIcon, ServerIcon, TimerIcon } from 'lucide-react';

export type RequestsRange = 'last-24h' | 'last-7d' | 'last-30d';

export type RequestsBucket = {
  ts: number;
  label: string;
  ok: number;
  failed: number;
  p50: number;
  p95: number;
  p99: number;
};

export type RouteShare = { path: string; requests: number };

export type RequestsDashboardProps = {
  range: RequestsRange;
  onRangeChange: (range: RequestsRange) => void;
  filters: FilterBarItem[];
  onFiltersChange: (filters: FilterBarItem[]) => void;
  buckets: RequestsBucket[];
  routes: RouteShare[];
  spend: number;
  previous: { requests: number; errorRate: number; p95: number; spend: number };
  isLoading: boolean;
  onOpenRequests: (bucket: RequestsBucket) => void;
};

const volumeSeries: MetricsLineChartSeries[] = [
  { dataKey: 'ok', label: 'Succeeded', color: 'var(--chart-share-1)' },
  { dataKey: 'failed', label: 'Failed', color: 'var(--chart-red)' },
];

const latencySeries: MetricsLineChartSeries[] = [
  { dataKey: 'p50', label: 'P50', color: 'var(--chart-share-2)' },
  { dataKey: 'p95', label: 'P95', color: 'var(--chart-share-1)', emphasis: true },
  { dataKey: 'p99', label: 'P99', color: 'var(--muted-foreground)' },
];

const rangeLabels: Record<RequestsRange, string> = {
  'last-24h': '24 hours',
  'last-7d': '7 days',
  'last-30d': '30 days',
};

const ranges: readonly RequestsRange[] = ['last-24h', 'last-7d', 'last-30d'];

const isRange = (value: string): value is RequestsRange => ranges.some(range => range === value);

const fieldColor = 'var(--muted-foreground)';

const filterFields: FilterBarField[] = [
  FILTER_BAR_TIME_RANGE_FIELD,
  { id: 'route', label: 'Route', icon: RouteIcon, color: fieldColor, search: true, operators: ['contains', 'is'] },
  {
    id: 'status',
    label: 'Status',
    icon: GlobeIcon,
    color: fieldColor,
    operators: ['is', 'is-not'],
    strict: true,
    suggestions: [
      { value: '2xx', label: '2xx' },
      { value: '4xx', label: '4xx' },
      { value: '5xx', label: '5xx' },
    ],
  },
  {
    id: 'environment',
    label: 'Environment',
    icon: ServerIcon,
    color: fieldColor,
    operators: ['is', 'is-not'],
    suggestions: [{ value: 'production' }, { value: 'staging' }],
  },
];

const isTimeRangeItem = (item: FilterBarItem) => item.fieldId === FILTER_BAR_TIME_RANGE_FIELD_ID;

const formatLatency = (value: number) => (value > 0 ? (formatDuration(value) ?? '—') : '—');

const formatRate = (ratio: number) => formatPercent(ratio) ?? '—';

const percentChange = (current: number, previous: number) =>
  current === 0 || previous === 0 ? undefined : ((current - previous) / previous) * 100;

export function RequestsDashboard({
  range,
  onRangeChange,
  filters,
  onFiltersChange,
  buckets,
  routes,
  spend,
  previous,
  isLoading,
  onOpenRequests,
}: RequestsDashboardProps) {
  const requests = buckets.reduce((sum, bucket) => sum + bucket.ok + bucket.failed, 0);
  const failed = buckets.reduce((sum, bucket) => sum + bucket.failed, 0);
  const errorRate = requests === 0 ? 0 : failed / requests;
  const p95 = Math.max(0, ...buckets.map(bucket => bucket.p95));
  const isEmpty = !isLoading && requests === 0;
  const comparison = `vs previous ${rangeLabels[range]}`;
  const openBucket = (index: number) => {
    const bucket = buckets[index];
    if (bucket) onOpenRequests(bucket);
  };

  return (
    <PageLayout
      breadcrumbs={
        <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden">
          <Crumb as="span" isCurrent>
            Requests
          </Crumb>
        </Breadcrumb>
      }
      actionRow={
        <ActionRow>
          <ActionRow.Start>
            <FilterBar
              fields={filterFields}
              operators={DEFAULT_FILTER_OPERATORS}
              value={[FILTER_BAR_TIME_RANGE_ITEM, ...filters]}
              onValueChange={(items: FilterBarItem[]) => onFiltersChange(items.filter(item => !isTimeRangeItem(item)))}
              createItemId={fieldId => fieldId}
              aria-label="Request filters"
              className="min-w-64 flex-1"
            >
              <FilterBar.Chips
                renderChip={item =>
                  isTimeRangeItem(item) ? (
                    <FilterBar.TimeRange
                      preset={range}
                      presets={ranges}
                      defaultPreset="last-24h"
                      onPresetChange={preset => {
                        if (isRange(preset)) onRangeChange(preset);
                      }}
                    />
                  ) : (
                    <FilterBar.Chip item={item} />
                  )
                }
              />
              <FilterBar.Input placeholder="Filter requests" />
            </FilterBar>
          </ActionRow.Start>
        </ActionRow>
      }
    >
      <div className="grid content-start gap-4 pb-6">
        <MetricsCardGroup>
          <KpiCard
            label="Requests"
            icon={ActivityIcon}
            value={formatCompactNumber(requests)}
            change={percentChange(requests, previous.requests)}
            previous={formatCompactNumber(previous.requests)}
            comparison={comparison}
            detail={`${formatCompactNumber(failed)} failed`}
            isLoading={isLoading}
          />
          <KpiCard
            label="Error rate"
            icon={CircleAlertIcon}
            value={formatRate(errorRate)}
            change={percentChange(errorRate, previous.errorRate)}
            previous={formatRate(previous.errorRate)}
            comparison={comparison}
            lowerIsBetter
            detail="Responses with a 5xx status"
            isLoading={isLoading}
          />
          <KpiCard
            label="P95 latency"
            icon={TimerIcon}
            value={formatLatency(p95)}
            change={percentChange(p95, previous.p95)}
            previous={formatLatency(previous.p95)}
            comparison={comparison}
            lowerIsBetter
            detail="Slowest bucket in the range"
            isLoading={isLoading}
          />
          <KpiCard
            label="Spend"
            icon={CoinsIcon}
            value={formatCost(spend)}
            change={percentChange(spend, previous.spend)}
            previous={formatCost(previous.spend)}
            comparison={comparison}
            detail="Model cost for these requests"
            isLoading={isLoading}
          />
        </MetricsCardGroup>
        <MetricsGrid columns={2}>
          <MetricsGrid.Item>
            <ChartCard
              variant="compact"
              title="Requests"
              total={formatCompactNumber(requests)}
              isLoading={isLoading}
              toolbar={
                <MetricsCard.Toolbar>
                  <MetricsLineChartLegend series={volumeSeries} />
                </MetricsCard.Toolbar>
              }
            >
              <ChartArea isEmpty={isEmpty} emptyMessage="No requests in this range.">
                <MetricsStackedBarChart
                  data={buckets}
                  series={volumeSeries}
                  height="fill"
                  xKey="label"
                  timestampKey="ts"
                  xLabels="edges"
                  showLegend={false}
                  valueFormatter={formatCompactNumber}
                  onBucketClick={(_row, index) => openBucket(index)}
                  isLoading={isLoading}
                />
              </ChartArea>
            </ChartCard>
          </MetricsGrid.Item>
          <MetricsGrid.Item>
            <ChartCard
              variant="compact"
              title="Latency"
              total={formatLatency(p95)}
              isLoading={isLoading}
              toolbar={
                <MetricsCard.Toolbar>
                  <MetricsLineChartLegend series={latencySeries} />
                </MetricsCard.Toolbar>
              }
            >
              <ChartArea isEmpty={isEmpty} emptyMessage="No requests in this range.">
                <MetricsLineChart
                  lineStyle="thin"
                  data={buckets}
                  series={latencySeries}
                  height="fill"
                  xKey="label"
                  timestampKey="ts"
                  xLabels="edges"
                  showLegend={false}
                  valueFormatter={formatLatency}
                  axisFormatter={value => formatDuration(value) ?? ''}
                  onBucketClick={(_row, index) => openBucket(index)}
                  isLoading={isLoading}
                />
              </ChartArea>
            </ChartCard>
          </MetricsGrid.Item>
        </MetricsGrid>
        <ChartCard title="Busiest routes" total={formatCompactNumber(requests)} isLoading={isLoading} bodyHeight="fit">
          <ShareBar
            valueLabel="Requests"
            rows={routes.map(route => ({
              key: route.path,
              label: route.path,
              share: route.requests,
              value: formatCompactNumber(route.requests),
            }))}
            palette="shades"
            overflow="other"
            isLoading={isLoading}
            emptyState="No requests in this range."
          />
        </ChartCard>
      </div>
    </PageLayout>
  );
}
