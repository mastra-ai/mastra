import { useState } from 'react';
import type { TimeRange } from '../drilldown';
import { useMetricsActivity } from '../hooks/use-metrics-activity';
import { useMetricsFilters } from '../hooks/use-metrics-filters';
import { EDGE_BUCKET_AXIS } from '../lib/chart-axis';
import { CHART_COLORS } from '../lib/chart-colors';
import { formatAxisCount, formatAxisUsd, formatCount, formatUsd } from '../lib/chart-format';
import { bucketPlan, bucketWindow } from '../lib/metrics-buckets';
import { OpenInTracesButton } from './card-action-buttons';
import { ChartArea } from './chart-area';
import { ChartCard } from './chart-card';
import { ChartCardError } from './chart-card-error';
import { MetricsCard } from '@/ds/components/MetricsCard';
import { MetricsLineChartLegend } from '@/ds/components/MetricsLineChart';
import type { MetricsLineChartSeries } from '@/ds/components/MetricsLineChart';
import { MetricsStackedBarChart } from '@/ds/components/MetricsStackedBarChart';

type View = 'tokens' | 'cost';

const TOKEN_SERIES: MetricsLineChartSeries[] = [
  { dataKey: 'input', label: 'Input', color: CHART_COLORS.green },
  { dataKey: 'cacheRead', label: 'Cache read', color: CHART_COLORS.violet },
  { dataKey: 'output', label: 'Output', color: CHART_COLORS.sky },
];
const COST_SERIES: MetricsLineChartSeries[] = [{ dataKey: 'cost', label: 'Cost', color: CHART_COLORS.green }];

const VIEWS = [
  { value: 'tokens', label: 'Token usage' },
  { value: 'cost', label: 'Model cost' },
] as const satisfies readonly { value: View; label: string }[];

/** Tokens (input, cache reads, output) or model cost per bucket; a bar opens its traces. */
export type TokenUsageCardProps = {
  /** Called from the "View in Traces" button. */
  onViewTraces?: () => void;
  /** Called with the time range of the clicked bar or point. */
  onTimeRangeClick?: (range: TimeRange) => void;
};

export function TokenUsageCard({ onViewTraces, onTimeRangeClick }: TokenUsageCardProps) {
  const [view, setView] = useState<View>('tokens');
  const { data = [], isLoading, isError, isPlaceholderData } = useMetricsActivity();
  const { timestamp } = useMetricsFilters();
  const { stepHours } = bucketPlan(timestamp.start, timestamp.end);
  const tokens = data.reduce((sum, b) => sum + b.input + b.cacheRead + b.output, 0);
  const cost = data.reduce((sum, b) => sum + b.cost, 0);
  const isTokens = view === 'tokens';
  const series = isTokens ? TOKEN_SERIES : COST_SERIES;

  const layout = {
    title: isTokens ? 'Token usage' : 'Model cost',
    titleMenu: { value: view, onValueChange: (v: string) => setView(v as View), options: VIEWS },
    actions: onViewTraces && <OpenInTracesButton onClick={onViewTraces} />,
    toolbar: (
      <MetricsCard.Toolbar>
        <MetricsLineChartLegend series={series} />
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
      total={isTokens ? formatCount(tokens) : formatUsd(cost)}
      isLoading={isLoading}
      isUpdating={isPlaceholderData}
    >
      <ChartArea isEmpty={!isLoading && tokens === 0 && cost === 0} emptyMessage="No model calls in this range.">
        <MetricsStackedBarChart
          data={data}
          series={series}
          height="fill"
          xLabels="edges"
          showLegend={false}
          valueFormatter={isTokens ? formatCount : formatUsd}
          axisFormatter={isTokens ? formatAxisCount : formatAxisUsd}
          onBucketClick={onTimeRangeClick && (row => onTimeRangeClick(bucketWindow(Number(row.ts), stepHours)))}
          isLoading={isLoading}
          {...EDGE_BUCKET_AXIS}
        />
      </ChartArea>
    </ChartCard>
  );
}
