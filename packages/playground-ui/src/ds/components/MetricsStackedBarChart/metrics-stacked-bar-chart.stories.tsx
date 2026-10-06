import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { MetricsCard } from '../MetricsCard';
import { count, coldStartSeries, ms, requestsByHour, statusSeries } from '../MetricsCard/metrics-story-data';
import type { MetricsLineChartSeries } from '../MetricsLineChart';
import { Txt } from '../Txt';
import { MetricsStackedBarChart } from './metrics-stacked-bar-chart';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' });

const data: Record<string, unknown>[] = Array.from({ length: 14 }, (_, i) => ({
  time: new Date(2026, 8, 14 + i).toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
  tokens: Math.round(40 + 30 * Math.sin(i / 2)),
  storage: Math.round(12 + 6 * Math.cos(i / 3)),
  compute: i % 5 === 0 ? 0 : Math.round(8 + i),
}));

const sum = (key: string) => (points: Record<string, unknown>[]) => ({
  value: usd.format(points.reduce<number>((total, p) => total + (typeof p[key] === 'number' ? p[key] : 0), 0)),
});

const series = [
  { dataKey: 'tokens', label: 'Tokens', color: 'var(--chart-blue)', aggregate: sum('tokens') },
  { dataKey: 'storage', label: 'Storage', color: 'var(--chart-green)', aggregate: sum('storage') },
  { dataKey: 'compute', label: 'Compute', color: 'var(--chart-orange)', aggregate: sum('compute') },
] satisfies MetricsLineChartSeries[];

const meta: Meta<typeof MetricsStackedBarChart> = {
  title: 'Metrics/MetricsStackedBarChart',
  component: MetricsStackedBarChart,
  parameters: { layout: 'centered' },
  args: { data, series, height: 224, valueFormatter: usd.format },
  render: args => (
    <div className="w-[min(48rem,calc(100vw-3rem))]">
      <MetricsStackedBarChart {...args} />
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof MetricsStackedBarChart>;

export const MultipleSeries: Story = {};

export const SingleSeries: Story = {
  args: {
    series: [{ dataKey: 'tokens', label: 'Tokens', color: 'var(--chart-blue)' }],
    valueFormatter: undefined,
    showLegend: false,
  },
};

/** One value per column with a solid cap marking the value (e.g. cold starts). */
export const SingleSeriesCapped: Story = {
  args: {
    ...SingleSeries.args,
    variant: 'capped',
  },
};

/** Capped works on stacks too; each segment gets its own cap. */
export const MultipleSeriesCapped: Story = {
  args: { variant: 'capped' },
};

export const AllZero: Story = {
  args: {
    data: data.map(({ time }) => ({ time, tokens: 0, storage: 0, compute: 0 })),
    yDomain: [0, 1],
  },
};

const included = 100;
const egress = data.map(({ time }, i) => ({ time, total: Math.round(9 * (i + 1) ** 1.05) }));

export const OverIncluded: Story = {
  args: {
    data: egress.map(({ time, total }) => ({
      time,
      included: Math.min(total, included),
      over: Math.max(total - included, 0),
    })),
    series: [
      { dataKey: 'included', label: 'Included', color: 'var(--gray-6)' },
      { dataKey: 'over', label: 'Over', color: 'var(--destructive-indicator)' },
    ],
    valueFormatter: value => `${value} GB`,
    referenceLine: { value: included, label: `${included} GB included`, color: 'var(--destructive-indicator)' },
    showLegend: false,
  },
};

/**
 * Status classes over a day with an incident. Thin 3xx/4xx/5xx slices keep a 2px minimum so
 * a handful of errors stays visible; hover a column to dim the others.
 */
export const StatusClasses: Story = {
  args: { data: requestsByHour, series: statusSeries, valueFormatter: count, height: 260 },
};

/** A dashed threshold line, e.g. a plan limit or an alert level. */
export const WithReferenceLine: Story = {
  args: {
    data: requestsByHour,
    series: statusSeries,
    valueFormatter: count,
    height: 260,
    referenceLine: { value: 3500, label: 'Rate limit', color: 'var(--chart-red)' },
  },
};

/**
 * `showYAxis={false}`: no value labels, the plot spans the card. Gridlines keep relative scale;
 * hover for exact values, with the column's total at the bottom of the tooltip.
 */
export const WithoutYAxis: Story = {
  args: { data: requestsByHour, series: statusSeries, valueFormatter: count, height: 260, showYAxis: false },
};

/**
 * A handful of errors next to thousands of successes, and one request in a quiet hour: every
 * non-zero value still draws a few readable pixels, zeros draw nothing.
 */
export const TinyValues: Story = {
  args: {
    data: Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`,
      ok: i === 6 ? 1 : 3000 + 400 * Math.sin(i / 3),
      errors: i % 4 === 0 ? 1 : 0,
    })),
    series: [
      { dataKey: 'ok', label: '2xx', color: 'var(--chart-green)' },
      { dataKey: 'errors', label: '5xx', color: 'var(--chart-red)' },
    ],
    valueFormatter: count,
    showYAxis: false,
  },
};

/** A dashed line over the bars on its own scale, e.g. average wake time over cold starts. */
export const WithOverlay: Story = {
  args: {
    data: requestsByHour.map((b, i) => ({ ...b, wakeMs: 1800 + 600 * Math.sin(i / 2) })),
    series: [{ dataKey: 'coldStarts', label: 'Cold starts', color: 'var(--chart-green)' }],
    overlay: {
      dataKey: 'wakeMs',
      label: 'Avg wake time',
      color: 'var(--chart-cyan)',
      valueFormatter: v => `${Math.round(v)}ms`,
    },
    valueFormatter: count,
    showYAxis: false,
  },
};

/** While data loads: ghost columns with a light sweep, in the chart's footprint. */
export const Loading: Story = {
  args: { data: requestsByHour, series: statusSeries, isLoading: true },
};

/**
 * `height="fill"` in two cards of different content heights: each chart takes its card's free
 * height (the content must be a flex column), so both cards end on one line.
 */
export const FillHeight: Story = {
  render: () => {
    const fill = { height: 'fill', xLabels: 'edges', showYAxis: false, valueFormatter: count } as const;
    const cards = [
      {
        title: 'Requests',
        description: 'Responses by status class. A wrapping description makes this top bar taller.',
        chart: <MetricsStackedBarChart {...fill} data={requestsByHour} series={statusSeries} />,
      },
      {
        title: 'Cold starts',
        description: 'Requests that woke a stopped app.',
        chart: (
          <MetricsStackedBarChart
            {...fill}
            data={requestsByHour}
            series={coldStartSeries}
            overlay={{ dataKey: 'wakeMs', label: 'Avg wake time', color: 'var(--chart-blue)', valueFormatter: ms }}
          />
        ),
      },
    ];
    return (
      <div className="grid w-[min(56rem,calc(100vw-3rem))] grid-cols-2 gap-4">
        {cards.map(card => (
          <MetricsCard key={card.title} className="min-h-0! min-w-0!">
            <MetricsCard.TopBar>
              <MetricsCard.TitleAndDescription title={card.title} description={card.description} />
            </MetricsCard.TopBar>
            <MetricsCard.Content className="flex h-full flex-col">{card.chart}</MetricsCard.Content>
          </MetricsCard>
        ))}
      </div>
    );
  },
};

function BucketClickDemo() {
  const [clicked, setClicked] = useState<string>();
  return (
    <div className="grid w-[min(48rem,calc(100vw-3rem))] gap-3">
      <MetricsStackedBarChart
        data={requestsByHour}
        series={statusSeries}
        valueFormatter={count}
        showYAxis={false}
        onBucketClick={row => setClicked(`${String(row.time)}: ${count(Number(row.total))} requests`)}
      />
      <Txt variant="body-sm" tone={clicked ? 'ink' : 'faint'}>
        {clicked ? `Clicked bucket ${clicked}` : 'Click a column, e.g. to open its traces.'}
      </Txt>
    </div>
  );
}

/** `onBucketClick`: the whole column is the target (pointer cursor), with the bucket's row. */
export const BucketClick: Story = { render: () => <BucketClickDemo /> };
