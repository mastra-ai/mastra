import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { MetricsLineChart } from './metrics-line-chart';
import type { MetricsLineChartSeries } from './metrics-line-chart';

const data: Record<string, unknown>[] = [
  { time: '09:00', requests: 42, errors: 2 },
  { time: '10:00', requests: 58, errors: 4 },
  { time: '11:00', requests: 51, errors: 1 },
  { time: '12:00', requests: 76, errors: 6 },
  { time: '13:00', requests: 83, errors: 3 },
  { time: '14:00', requests: 91, errors: 5 },
  { time: '15:00', requests: 72, errors: 2 },
];

const total = (key: string) => (points: Record<string, unknown>[]) => ({
  value: String(points.reduce((sum, point) => sum + (typeof point[key] === 'number' ? point[key] : 0), 0)),
  suffix: 'total',
});

const series = [
  { dataKey: 'requests', label: 'Requests', color: '#60a5fa', aggregate: total('requests') },
  { dataKey: 'errors', label: 'Errors', color: '#f87171', aggregate: total('errors') },
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
    xAxisInterval: 'preserveStartEnd',
    xAxisMinTickGap: 28,
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
    series: [{ dataKey: 'requests', label: 'Requests', color: '#60a5fa' }],
    showDots: true,
  },
  render: args => (
    <div className="w-[min(48rem,calc(100vw-3rem))]">
      <MetricsLineChart {...args} />
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
    series: [{ dataKey: 'score', label: 'Answer relevancy', color: '#a78bfa' }],
    yDomain: [0, 1],
    showDots: true,
  },
  render: args => (
    <div className="w-[min(48rem,calc(100vw-3rem))]">
      <MetricsLineChart {...args} />
    </div>
  ),
};
