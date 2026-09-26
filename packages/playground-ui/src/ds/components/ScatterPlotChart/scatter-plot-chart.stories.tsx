import type { Meta, StoryObj } from '@storybook/react-vite';
import { ScatterPlotChart } from './scatter-plot-chart';

const data = [
  { id: 'refund-checkout', duration: 120, cost: 0.22, color: 'var(--chart-1)' },
  { id: 'refund-policy', duration: 180, cost: 0.34, color: 'var(--chart-1)' },
  { id: 'shipping-delay', duration: 260, cost: 0.51, color: 'var(--chart-2)' },
  { id: 'shipping-update', duration: 320, cost: 0.64, color: 'var(--chart-2)' },
  { id: 'competitor-analysis', duration: 420, cost: 0.91, color: 'var(--chart-3)' },
];

const meta: Meta<typeof ScatterPlotChart> = {
  title: 'Metrics/ScatterPlotChart',
  component: ScatterPlotChart,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof ScatterPlotChart>;

export const Default: Story = {
  render: () => (
    <div style={{ width: '36rem' }}>
      <ScatterPlotChart
        data={data}
        xKey="duration"
        yKey="cost"
        nameKey="id"
        colorKey="color"
        xLabel="Duration"
        yLabel="Cost"
        formatX={value => `${value}ms`}
        formatY={value => `$${value}`}
      />
    </div>
  ),
};

export const Empty: Story = {
  render: () => (
    <div style={{ width: '36rem' }}>
      <ScatterPlotChart data={[]} xKey="duration" yKey="cost" xLabel="Duration" yLabel="Cost" />
    </div>
  ),
};

export const Clickable: Story = {
  render: () => (
    <div style={{ width: '36rem' }}>
      <ScatterPlotChart
        data={data}
        xKey="duration"
        yKey="cost"
        nameKey="id"
        colorKey="color"
        xLabel="Duration"
        yLabel="Cost"
        formatX={value => `${value}ms`}
        formatY={value => `$${value}`}
        onPointClick={point => console.log('point clicked', point)}
      />
    </div>
  ),
};

export const WithFixedDomains: Story = {
  render: () => (
    <div style={{ width: '36rem' }}>
      <ScatterPlotChart
        data={data}
        xKey="duration"
        yKey="cost"
        nameKey="id"
        colorKey="color"
        xLabel="Duration"
        yLabel="Cost"
        xDomain={[0, 600]}
        yDomain={[0, 1.5]}
        formatX={value => `${value}ms`}
        formatY={value => `$${value}`}
      />
    </div>
  ),
};

export const FillsContainer: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', width: '36rem', height: '20rem' }}>
      <ScatterPlotChart
        data={data}
        xKey="duration"
        yKey="cost"
        nameKey="id"
        colorKey="color"
        xLabel="Duration"
        yLabel="Cost"
        height="100%"
        formatX={value => `${value}ms`}
        formatY={value => `$${value}`}
      />
    </div>
  ),
};

export const CustomTooltipLabel: Story = {
  render: () => (
    <div style={{ width: '36rem' }}>
      <ScatterPlotChart
        data={data}
        xKey="duration"
        yKey="cost"
        nameKey="id"
        colorKey="color"
        xLabel="Duration"
        yLabel="Cost"
        formatX={value => `${value}ms`}
        formatY={value => `$${value}`}
        formatTooltipLabel={point => `Topic: ${String(point.id)}`}
      />
    </div>
  ),
};
