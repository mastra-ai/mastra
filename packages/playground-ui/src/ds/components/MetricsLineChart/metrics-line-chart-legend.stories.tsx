import type { Meta, StoryObj } from '@storybook/react-vite';
import { percentileSeries, requestsByHour, statusSeries } from '../MetricsCard/metrics-story-data';
import { MetricsLineChartLegend } from './metrics-line-chart-legend';

const meta: Meta<typeof MetricsLineChartLegend> = {
  title: 'Metrics/MetricsLineChartLegend',
  component: MetricsLineChartLegend,
  parameters: { layout: 'centered' },
  args: { data: requestsByHour },
};

export default meta;
type Story = StoryObj<typeof MetricsLineChartLegend>;

/** Square markers with each series' aggregate beside its label. */
export const WithAggregates: Story = {
  args: { series: statusSeries },
};

/** Without `aggregate`, just the marker and the label. */
export const LabelsOnly: Story = {
  args: { series: percentileSeries.map(({ aggregate: _aggregate, ...s }) => s) },
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
