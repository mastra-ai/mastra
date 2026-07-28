import type { Meta, StoryObj } from '@storybook/react-vite';

import { MetricsBarChart, type MetricsBarChartSeries } from './metrics-bar-chart';

const data = [
  { time: '2026-07-10', done: 2 },
  { time: '2026-07-11', done: 4 },
  { time: '2026-07-12', done: 1 },
  { time: '2026-07-13', done: 6 },
  { time: '2026-07-14', done: 3 },
  { time: '2026-07-15', done: 8 },
  { time: '2026-07-16', done: 5 },
  { time: '2026-07-17', done: 7 },
  { time: '2026-07-18', done: 4 },
  { time: '2026-07-19', done: 9 },
  { time: '2026-07-20', done: 6 },
  { time: '2026-07-21', done: 10 },
  { time: '2026-07-22', done: 7 },
  { time: '2026-07-23', done: 12 },
];
const series: Array<MetricsBarChartSeries> = [
  {
    dataKey: 'done',
    label: 'Completed work',
    color: 'oklch(from var(--accent1) l calc(c * 0.72) h)',
    appearance: 'dotted',
  },
];
const AXIS_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const TOOLTIP_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

function formatDate(value: unknown, formatter: Intl.DateTimeFormat): string {
  if (typeof value !== 'string') return String(value ?? '');

  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(timestamp) ? value : formatter.format(timestamp);
}

const meta: Meta<typeof MetricsBarChart> = {
  title: 'Metrics/MetricsBarChart',
  component: MetricsBarChart,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof MetricsBarChart>;

export const Default: Story = {
  render: () => (
    <div style={{ width: '48rem' }}>
      <MetricsBarChart
        data={data}
        series={series}
        description="Daily completed work for the selected reporting period."
        height={240}
        xAxisInterval="preserveStartEnd"
        xAxisMinTickGap={40}
        xAxisTickFormatter={value => formatDate(value, AXIS_DATE_FORMATTER)}
        tooltipLabelFormatter={value => formatDate(value, TOOLTIP_DATE_FORMATTER)}
      />
    </div>
  ),
};
