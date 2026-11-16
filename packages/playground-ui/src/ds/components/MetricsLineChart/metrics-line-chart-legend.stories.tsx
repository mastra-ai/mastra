import type { Meta, StoryObj } from '@storybook/react-vite';
import { requestsVsPreviousSeries, statusSeries } from '../MetricsCard/metrics-story-data';
import { MetricsLineChartLegend } from './metrics-line-chart-legend';

const meta: Meta<typeof MetricsLineChartLegend> = {
  title: 'Metrics/MetricsLineChartLegend',
  component: MetricsLineChartLegend,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof MetricsLineChartLegend>;

/** A square marker and the label per series. */
export const Default: Story = {
  args: { series: statusSeries },
};

/** A dashed series (e.g. the previous period) gets a dashed marker. */
export const Dashed: Story = {
  args: { series: requestsVsPreviousSeries },
};

/** Long labels truncate instead of pushing the row wider. */
export const LongLabels: Story = {
  args: {
    series: [
      { dataKey: '2xx', label: 'research-supervisor-agent', color: 'var(--chart-green)' },
      { dataKey: '4xx', label: 'content-moderation-assistant', color: 'var(--chart-amber)' },
    ],
  },
  render: args => (
    <div style={{ width: '20rem' }}>
      <MetricsLineChartLegend {...args} />
    </div>
  ),
};
