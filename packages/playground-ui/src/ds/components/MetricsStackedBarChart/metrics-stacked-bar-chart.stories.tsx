import type { Meta, StoryObj } from '@storybook/react-vite';

import type { MetricsLineChartSeries } from '../MetricsLineChart';
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
