import type { Meta, StoryObj } from '@storybook/react-vite';
import { EyeIcon, LogsIcon } from 'lucide-react';
import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { fn } from 'storybook/test';

import { Button } from '../Button/Button';
import { MetricsCard } from '../MetricsCard';
import {
  count,
  errorRateSeries,
  ms,
  percent,
  percentileSeries,
  requestsByHour,
  requestsVsPreviousSeries,
} from '../MetricsCard/metrics-story-data';
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

const series = [
  { dataKey: 'input', label: 'Input tokens', color: 'var(--chart-blue)' },
  { dataKey: 'output', label: 'Output tokens', color: 'var(--chart-amber)' },
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

const latencySeries = [
  { dataKey: 'p50', label: 'p50', color: 'var(--chart-sequential-1)' },
  { dataKey: 'p95', label: 'p95', color: 'var(--chart-sequential-3)' },
] satisfies MetricsLineChartSeries[];

const TRAFFIC_VIEWS = [
  { value: 'volume', label: 'Token volume' },
  { value: 'latency', label: 'Latency' },
] as const;

function TrafficCard(args: ComponentProps<typeof MetricsLineChart>) {
  const [view, setView] = useState<'volume' | 'latency'>('volume');
  const chart =
    view === 'volume' ? { data: args.data, series: args.series } : { data: latencyData, series: latencySeries };

  return (
    <MetricsCard>
      <MetricsCard.TopBar>
        <MetricsCard.TitleMenu
          title={TRAFFIC_VIEWS.find(v => v.value === view)?.label ?? ''}
          value={view}
          onValueChange={setView}
          options={TRAFFIC_VIEWS}
        />
        <MetricsCard.Actions>
          <Button variant="ghost" size="icon-md" tooltip="View in traces" aria-label="View in traces">
            <EyeIcon />
          </Button>
          <Button variant="ghost" size="icon-md" tooltip="View errors in logs" aria-label="View errors in logs">
            <LogsIcon />
          </Button>
        </MetricsCard.Actions>
      </MetricsCard.TopBar>
      <MetricsCard.Content className="flex flex-col gap-4 overflow-visible">
        <MetricsCard.Toolbar>
          <MetricsLineChartLegend series={chart.series} />
        </MetricsCard.Toolbar>
        <MetricsLineChart {...args} {...chart} showLegend={false} />
      </MetricsCard.Content>
    </MetricsCard>
  );
}

/** In a card whose title menu switches the chart, with the legend in the toolbar. */
export const InMetricsCardWithTitleMenu: Story = {
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

/** `showYAxis={false}`: no value labels, the plot spans the card. Hover for exact values. */
export const WithoutYAxis: Story = {
  args: { data: requestsByHour, series: percentileSeries, valueFormatter: ms, showYAxis: false },
  render: args => (
    <div className="w-[min(48rem,calc(100vw-3rem))]">
      <MetricsLineChart {...args} />
    </div>
  ),
};

const wide = (node: ReactNode) => <div className="w-[min(48rem,calc(100vw-3rem))]">{node}</div>;

/**
 * This period against the last: the current series solid with `emphasis`, the comparison
 * `dashed` (a plain line, no fill). Rows carry `tsMs`, so labels sit on round clock times.
 */
export const VsPreviousPeriod: Story = {
  args: { data: requestsByHour, series: requestsVsPreviousSeries, valueFormatter: count },
  render: args => wide(<MetricsLineChart {...args} />),
};

/** `emphasis` on the series to read first (P95): half a pixel heavier than its companions. */
export const Emphasis: Story = {
  args: {
    data: requestsByHour,
    series: percentileSeries.map(s => ({ ...s, emphasis: s.dataKey === 'p95' })),
    valueFormatter: ms,
  },
  render: args => wide(<MetricsLineChart {...args} />),
};

/** `xLabels="edges"`: only the first and last bucket, pinned to the plot edges, for small cards. */
export const EdgeLabels: Story = {
  args: { data: requestsByHour, series: errorRateSeries, valueFormatter: percent, xLabels: 'edges', showYAxis: false },
  render: args => (
    <div className="w-[min(24rem,calc(100vw-3rem))]">
      <MetricsLineChart {...args} />
    </div>
  ),
};

function FillCard({ title, total, children }: { title: string; total: string; children: ReactNode }) {
  return (
    <MetricsCard className="min-h-0! min-w-0!">
      <MetricsCard.TopBar>
        <MetricsCard.Title>{title}</MetricsCard.Title>
        <MetricsCard.Total value={total} />
      </MetricsCard.TopBar>
      <MetricsCard.Content className="flex h-full flex-col">{children}</MetricsCard.Content>
    </MetricsCard>
  );
}

/**
 * `height="fill"`: the chart takes the card's free height (the content must be a flex column),
 * so cards in a row end on one line even when their headers differ in height.
 */
export const FillHeight: Story = {
  render: () => (
    <div className="grid w-[min(56rem,calc(100vw-3rem))] grid-cols-2 gap-4">
      <FillCard title="Requests" total="63.9K">
        <MetricsLineChart
          data={requestsByHour}
          series={requestsVsPreviousSeries}
          valueFormatter={count}
          height="fill"
          xLabels="edges"
          showYAxis={false}
        />
      </FillCard>
      <FillCard title="Latency" total="2.3s">
        <MetricsLineChart
          data={requestsByHour}
          series={percentileSeries}
          valueFormatter={ms}
          height="fill"
          xLabels="edges"
          showYAxis={false}
        />
      </FillCard>
    </div>
  ),
};

/** `isLoading`: a line ghost in the chart's footprint. The legend stays, built from the series. */
export const Loading: Story = {
  args: { data: requestsByHour, series: requestsVsPreviousSeries, isLoading: true },
  render: args => wide(<MetricsLineChart {...args} />),
};

/**
 * `lineStyle="thin"` with `dots="hover"`, for small cards in a grid: 1.5px lines, a fainter fill
 * that fades out at both ends, and a dot only on the hovered point (a short series otherwise gets
 * one on every point).
 */
export const ThinLines: Story = {
  args: { lineStyle: 'thin', dots: 'hover' },
  render: args => (
    <div className="w-[min(48rem,calc(100vw-3rem))]">
      <MetricsLineChart {...args} />
    </div>
  ),
};
