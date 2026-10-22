import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { MetricsLineChart, MetricsLineChartLegend } from '../../../ds/components/MetricsLineChart';
import type { MetricsLineChartSeries } from '../../../ds/components/MetricsLineChart';
import { bucketLabels } from '../lib/bucket-labels';
import { EDGE_BUCKET_AXIS } from '../lib/chart-axis';
import { CHART_COLORS } from '../lib/chart-colors';
import { ChartArea } from './chart-area';
import { ChartCard } from './chart-card';

const DAY = 24 * 3_600_000;
const start = new Date(2026, 9, 15).getTime();
const usd = (v: number) => `$${v.toFixed(2)}`;
const axisUsd = (v: number) => `$${v.toFixed(v < 10 ? 1 : 0)}`;
const tokens = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

// A week of gateway spend: the top model peaks at $4.40 on the busiest day.
const spend: [number, number, number][] = [
  [1.2, 0.6, 0.3],
  [2.1, 0.9, 0.4],
  [1.6, 0.7, 0.2],
  [4.4, 1.2, 0.4],
  [1.9, 1.1, 0.5],
  [1.1, 0.4, 0.2],
  [1.4, 0.8, 0.3],
];
const data = spend.map(([a, b, c], i) => ({
  ...bucketLabels(start + i * DAY, 24, true),
  sonnet: a,
  gpt: b,
  gemini: c,
  openai: b,
  anthropic: a,
  google: c,
  input: Math.round((a + b + c) * 90_000),
  cached: Math.round((a + b) * 40_000),
  output: Math.round((a + b + c) * 24_000),
}));

const byModel: MetricsLineChartSeries[] = [
  { dataKey: 'sonnet', label: 'claude-sonnet-4-5', color: CHART_COLORS.green },
  { dataKey: 'gpt', label: 'gpt-5-mini', color: CHART_COLORS.sky },
  { dataKey: 'gemini', label: 'gemini-2.5-flash', color: CHART_COLORS.violet },
];
const byProvider: MetricsLineChartSeries[] = [
  { dataKey: 'anthropic', label: 'Anthropic', color: CHART_COLORS.green },
  { dataKey: 'openai', label: 'OpenAI', color: CHART_COLORS.sky },
  { dataKey: 'google', label: 'Google', color: CHART_COLORS.violet },
];
const tokenSeries: MetricsLineChartSeries[] = [
  { dataKey: 'input', label: 'Input', color: CHART_COLORS.green },
  { dataKey: 'cached', label: 'Cache read', color: CHART_COLORS.violet },
  { dataKey: 'output', label: 'Output', color: CHART_COLORS.sky },
];

const meta: Meta<typeof ChartCard> = {
  title: 'Metrics/ChartCard',
  component: ChartCard,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof ChartCard>;

/** The Metrics page's card: title and description, a 240px body. */
export const Default: Story = {
  render: () => (
    <div className="w-[min(36rem,calc(100vw-3rem))]">
      <ChartCard title="Spend" description="By model." toolbar={<MetricsLineChartLegend series={byModel} />}>
        <ChartArea>
          <MetricsLineChart
            data={data}
            series={byModel}
            height="fill"
            xLabels="edges"
            showLegend={false}
            valueFormatter={usd}
            axisFormatter={axisUsd}
            {...EDGE_BUCKET_AXIS}
          />
        </ChartArea>
      </ChartCard>
    </div>
  ),
};

function SpendCard() {
  const [view, setView] = useState<'model' | 'provider'>('model');
  const series = view === 'model' ? byModel : byProvider;
  return (
    <ChartCard
      variant="compact"
      title={view === 'model' ? 'Spend by model' : 'Spend by provider'}
      titleMenu={{
        value: view,
        onValueChange: v => setView(v as 'model' | 'provider'),
        options: [
          { value: 'model', label: 'By model' },
          { value: 'provider', label: 'By provider' },
        ],
      }}
      total="$27.40"
      toolbar={<MetricsLineChartLegend series={series} />}
    >
      <ChartArea>
        <MetricsLineChart
          data={data}
          series={series}
          height="fill"
          xLabels="edges"
          showLegend={false}
          lineStyle="thin"
          dots="hover"
          valueFormatter={usd}
          axisFormatter={axisUsd}
          {...EDGE_BUCKET_AXIS}
        />
      </ChartArea>
    </ChartCard>
  );
}

/**
 * `variant="compact"`, for a grid of small cards: title and total on one line, one card height,
 * the chart filling what the legend leaves. The title can switch views (`titleMenu`). The charts
 * use `lineStyle="thin"` and `dots="hover"`.
 */
export const Compact: Story = {
  render: () => (
    <div className="grid w-[min(64rem,calc(100vw-3rem))] grid-cols-2 gap-4">
      <SpendCard />
      <ChartCard
        variant="compact"
        title="Tokens"
        total="1.6M"
        toolbar={<MetricsLineChartLegend series={tokenSeries} />}
      >
        <ChartArea>
          <MetricsLineChart
            data={data}
            series={tokenSeries}
            height="fill"
            xLabels="edges"
            showLegend={false}
            lineStyle="thin"
            dots="hover"
            valueFormatter={tokens.format}
            axisFormatter={tokens.format}
            {...EDGE_BUCKET_AXIS}
          />
        </ChartArea>
      </ChartCard>
    </div>
  ),
};

/** `isLoading`: a skeleton in place of the total. */
export const CompactLoading: Story = {
  render: () => (
    <div className="w-[min(32rem,calc(100vw-3rem))]">
      <ChartCard
        variant="compact"
        title="Tokens"
        total="1.6M"
        isLoading
        toolbar={<MetricsLineChartLegend series={tokenSeries} />}
      >
        <ChartArea>
          <MetricsLineChart data={data} series={tokenSeries} height="fill" showLegend={false} isLoading />
        </ChartArea>
      </ChartCard>
    </div>
  ),
};
