import type { Meta, StoryObj } from '@storybook/react-vite';
import { count, ms } from '../MetricsCard/metrics-story-data';
import { MetricsLineChartTooltip } from '../MetricsLineChart/metrics-line-chart-tooltip';
import { ChartTooltip } from './chart-tooltip';

const meta: Meta<typeof ChartTooltip> = {
  title: 'Metrics/ChartTooltip',
  component: ChartTooltip,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof ChartTooltip>;

/** What the metrics charts show on hover: the bucket, then one row per series. */
export const SeriesReadout: Story = {
  render: () => (
    <MetricsLineChartTooltip
      active
      label="Oct 1, 5 PM"
      formatValue={count}
      payload={[
        { name: '2xx', value: 3420, color: 'var(--chart-green)' },
        { name: '3xx', value: 74, color: 'var(--chart-blue)' },
        { name: '4xx', value: 118, color: 'var(--chart-amber)' },
        { name: '5xx', value: 311, color: 'var(--chart-red)' },
      ]}
    />
  ),
};

/** Values right-align in tabular figures, so mixed widths still line up. */
export const Percentiles: Story = {
  render: () => (
    <MetricsLineChartTooltip
      active
      label="Oct 1, 5 PM"
      formatValue={ms}
      payload={[
        { name: 'P50', value: 806, color: 'var(--chart-sequential-1)' },
        { name: 'P95', value: 2720, color: 'var(--chart-sequential-3)' },
        { name: 'P99', value: 7940, color: 'var(--chart-sequential-5)' },
      ]}
    />
  ),
};

/** The bare surface, for custom readouts (scatter points, sankey nodes). */
export const Custom: Story = {
  render: () => (
    <ChartTooltip>
      <p className="text-foreground">research-supervisor</p>
      <p className="text-muted-foreground">25.3K tokens · $0.04</p>
    </ChartTooltip>
  ),
};
