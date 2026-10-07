import { useState } from 'react';
import { useBucketTracesNav } from '../hooks/use-bucket-traces-nav';
import { useDrilldown } from '../hooks/use-drilldown';
import { useMetricsActivity } from '../hooks/use-metrics-activity';
import { BUCKET_AXIS } from '../lib/chart-axis';
import { CHART_COLORS } from '../lib/chart-colors';
import { formatAxisCount, formatCount, formatUsd } from '../lib/chart-format';
import { OpenInTracesButton } from './card-action-buttons';
import { ChartArea } from './chart-area';
import { ChartCard } from './chart-card';
import { MetricsCard } from '@/ds/components/MetricsCard';
import { MetricsLineChartLegend } from '@/ds/components/MetricsLineChart';
import type { MetricsLineChartSeries } from '@/ds/components/MetricsLineChart';
import { MetricsStackedBarChart } from '@/ds/components/MetricsStackedBarChart';
import { useLinkComponent } from '@/lib/framework';

type View = 'tokens' | 'cost';

const TOKEN_SERIES: MetricsLineChartSeries[] = [
  { dataKey: 'input', label: 'Input', color: CHART_COLORS.green },
  { dataKey: 'cacheRead', label: 'Cache read', color: CHART_COLORS.violet },
  { dataKey: 'output', label: 'Output', color: CHART_COLORS.sky },
];
const COST_SERIES: MetricsLineChartSeries[] = [{ dataKey: 'cost', label: 'Cost', color: CHART_COLORS.green }];

const axisUsd = (value: number) => `$${value.toFixed(value < 10 ? 1 : 0)}`;

/** Tokens (input, cache reads, output) or model cost per bucket; a bar opens its traces. */
export function TokenUsageCard() {
  const { Link } = useLinkComponent();
  const [view, setView] = useState<View>('tokens');
  const { data = [], isLoading, isError, isPlaceholderData } = useMetricsActivity();
  const { getTracesHref } = useDrilldown();
  const openBucket = useBucketTracesNav()({});
  const tokens = data.reduce((sum, b) => sum + b.input + b.cacheRead + b.output, 0);
  const cost = data.reduce((sum, b) => sum + b.cost, 0);
  const isTokens = view === 'tokens';
  const series = isTokens ? TOKEN_SERIES : COST_SERIES;

  return (
    <ChartCard
      title="Token usage"
      description={isTokens ? 'Input, cache reads and output.' : 'Estimated model spend.'}
      summary={isTokens ? { value: formatCount(tokens), label: 'tokens' } : { value: formatUsd(cost), label: 'cost' }}
      actions={<OpenInTracesButton href={getTracesHref({})} LinkComponent={Link} />}
      isLoading={isLoading}
      isUpdating={isPlaceholderData}
      isError={isError}
    >
      <MetricsCard.Toolbar>
        <MetricsLineChartLegend series={series} />
        <MetricsCard.Tabs<View> value={view} onValueChange={setView}>
          <MetricsCard.Tab value="tokens">Tokens</MetricsCard.Tab>
          <MetricsCard.Tab value="cost">Cost</MetricsCard.Tab>
        </MetricsCard.Tabs>
      </MetricsCard.Toolbar>
      <ChartArea
        isError={isError}
        isEmpty={!isLoading && tokens === 0 && cost === 0}
        emptyMessage="No model calls in this range."
      >
        <MetricsStackedBarChart
          data={data}
          series={series}
          height={240}
          showLegend={false}
          showYAxis={false}
          valueFormatter={isTokens ? formatCount : formatUsd}
          axisFormatter={isTokens ? formatAxisCount : axisUsd}
          onBucketClick={openBucket}
          isLoading={isLoading}
          {...BUCKET_AXIS}
        />
      </ChartArea>
    </ChartCard>
  );
}
