import type { Meta, StoryObj } from '@storybook/react-vite';
import { EyeIcon, LogsIcon } from 'lucide-react';
import { useState } from 'react';
import type { ComponentProps } from 'react';
import { fn } from 'storybook/test';

import { Button } from '../Button/Button';
import { MetricsCard } from '../MetricsCard';
import { errorRateSeries, ms, percent, percentileSeries, requestsByHour } from '../MetricsCard/metrics-story-data';
import { Tab, TabContent, TabList, Tabs } from '../Tabs';
import { MetricsLineChart } from './metrics-line-chart';
import type { MetricsLineChartSeries } from './metrics-line-chart';
import { MetricsLineChartLegend } from './metrics-line-chart-legend';

// Input and output tokens share a scale, so neither line is flattened against the axis.
const data: Record<string, unknown>[] = [
  { time: '09:00', input: 52_000, output: 18_000 },
  { time: '10:00', input: 184_000, output: 61_000 },
  { time: '11:00', input: 97_000, output: 40_000 },
  { time: '12:00', input: 412_000, output: 133_000 },
  { time: '13:00', input: 596_000, output: 201_000 },
  { time: '14:00', input: 238_000, output: 92_000 },
  { time: '15:00', input: 341_000, output: 120_000 },
];

const total = (key: string) => (points: Record<string, unknown>[]) => ({
  value: new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 2 }).format(
    points.reduce<number>((sum, point) => sum + (typeof point[key] === 'number' ? point[key] : 0), 0),
  ),
});

const series = [
  { dataKey: 'input', label: 'Input tokens', color: 'var(--chart-blue)', aggregate: total('input') },
  { dataKey: 'output', label: 'Output tokens', color: 'var(--chart-amber)', aggregate: total('output') },
] satisfies MetricsLineChartSeries[];

const meta: Meta<typeof MetricsLineChart> = {
  title: 'Metrics/MetricsLineChart',
  component: MetricsLineChart,
  parameters: { layout: 'centered' },
  args: {
    data,
    series,
    height: 260,
    onPointClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof MetricsLineChart>;

export const MultipleSeries: Story = {
  render: args => (
    <div className="w-[min(48rem,calc(100vw-3rem))]">
      <MetricsLineChart {...args} />
    </div>
  ),
};

export const SinglePoint: Story = {
  args: {
    data: [{ time: 'Now', requests: 42 }],
    series: [{ dataKey: 'requests', label: 'Requests', color: 'var(--chart-blue)' }],
    showDots: true,
  },
  render: args => (
    <div className="w-[min(48rem,calc(100vw-3rem))]">
      <MetricsLineChart {...args} />
    </div>
  ),
};

// 30 daily buckets, as the latency card renders for the 30d preset.
const latencyData: Record<string, unknown>[] = Array.from({ length: 30 }, (_, i) => ({
  time: new Date(2026, 7, 26 + i).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
  p50: Math.round(130 + 25 * Math.sin(i / 2.5)),
  p95: Math.round(550 + 160 * Math.sin(i / 3.5 + 1)),
}));

const average = (key: string) => (points: Record<string, unknown>[]) => {
  const values = points.map(point => point[key]).filter((v): v is number => typeof v === 'number');
  return { value: `${Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)}ms` };
};

const latencySeries = [
  { dataKey: 'p50', label: 'p50', color: 'var(--chart-sequential-1)', aggregate: average('p50') },
  { dataKey: 'p95', label: 'p95', color: 'var(--chart-sequential-3)', aggregate: average('p95') },
] satisfies MetricsLineChartSeries[];

function TrafficCard(args: ComponentProps<typeof MetricsLineChart>) {
  const [tab, setTab] = useState<'volume' | 'latency'>('volume');
  const legend =
    tab === 'volume' ? { data: args.data, series: args.series } : { data: latencyData, series: latencySeries };

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleAndDescription title="Traffic" description="Requests, errors and latency." />
        <MetricsCard.Actions>
          <Button variant="ghost" size="icon-md" tooltip="View in Traces" aria-label="View in Traces">
            <EyeIcon />
          </Button>
          <Button variant="ghost" size="icon-md" tooltip="View errors in Logs" aria-label="View errors in Logs">
            <LogsIcon />
          </Button>
        </MetricsCard.Actions>
      </MetricsCard.TopBar>
      <MetricsCard.Content>
        <Tabs defaultTab="volume" value={tab} onValueChange={setTab} className="overflow-visible">
          <div className="flex flex-wrap items-center justify-between gap-2 [&>:first-child]:w-auto">
            <TabList>
              <Tab value="volume">Volume</Tab>
              <Tab value="latency">Latency</Tab>
            </TabList>
            <MetricsLineChartLegend {...legend} />
          </div>
          <TabContent value="volume" className="pt-3">
            <MetricsLineChart {...args} showLegend={false} />
          </TabContent>
          <TabContent value="latency" className="pt-3">
            <MetricsLineChart {...args} data={latencyData} series={latencySeries} showLegend={false} />
          </TabContent>
        </Tabs>
      </MetricsCard.Content>
    </MetricsCard>
  );
}

export const InMetricsCardWithTabs: Story = {
  render: args => (
    <div className="w-[min(48rem,calc(100vw-3rem))]">
      <TrafficCard {...args} />
    </div>
  ),
};

export const FixedDomain: Story = {
  args: {
    data: [
      { time: 'Mon', score: 0.72 },
      { time: 'Tue', score: 0.81 },
      { time: 'Wed', score: 0.76 },
      { time: 'Thu', score: 0.93 },
    ],
    series: [{ dataKey: 'score', label: 'Answer relevancy', color: 'var(--chart-purple)' }],
    yDomain: [0, 1],
    showDots: true,
  },
  render: args => (
    <div className="w-[min(48rem,calc(100vw-3rem))]">
      <MetricsLineChart {...args} />
    </div>
  ),
};

/** Latency percentiles on the sequential ramp: lighter for the median, deeper for the tail. */
export const Percentiles: Story = {
  args: { data: requestsByHour, series: percentileSeries, valueFormatter: ms },
  render: args => (
    <div className="w-[min(48rem,calc(100vw-3rem))]">
      <MetricsLineChart {...args} />
    </div>
  ),
};

/** Rates as percentages: axis ticks and tooltip values go through `valueFormatter`. */
export const ErrorRate: Story = {
  args: { data: requestsByHour, series: errorRateSeries, valueFormatter: percent },
  render: args => (
    <div className="w-[min(48rem,calc(100vw-3rem))]">
      <MetricsLineChart {...args} />
    </div>
  ),
};

/** 30 daily points: axis labels thin out to fit instead of colliding. */
export const LongRange: Story = {
  args: { data: latencyData, series: latencySeries, valueFormatter: ms },
  render: args => (
    <div className="w-[min(48rem,calc(100vw-3rem))]">
      <MetricsLineChart {...args} />
    </div>
  ),
};
