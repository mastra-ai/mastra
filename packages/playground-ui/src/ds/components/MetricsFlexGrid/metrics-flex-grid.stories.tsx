import type { Meta, StoryObj } from '@storybook/react-vite';
import { DashboardCard } from '../DashboardCard';
import { MetricsFlexGrid } from './metrics-flex-grid';

const meta: Meta<typeof MetricsFlexGrid> = {
  title: 'Metrics/MetricsFlexGrid',
  component: MetricsFlexGrid,
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof MetricsFlexGrid>;

export const Default: Story = {
  render: () => (
    <MetricsFlexGrid>
      <DashboardCard className="min-w-60">
        <p className="text-neutral3">Card 1</p>
      </DashboardCard>
      <DashboardCard className="min-w-60">
        <p className="text-neutral3">Card 2</p>
      </DashboardCard>
      <DashboardCard className="min-w-60">
        <p className="text-neutral3">Card 3</p>
      </DashboardCard>
      <DashboardCard className="min-w-60">
        <p className="text-neutral3">Card 4</p>
      </DashboardCard>
    </MetricsFlexGrid>
  ),
};

export const TwoItems: Story = {
  render: () => (
    <MetricsFlexGrid>
      <DashboardCard className="min-w-60">
        <p className="text-neutral3">Card 1</p>
      </DashboardCard>
      <DashboardCard className="min-w-60">
        <p className="text-neutral3">Card 2</p>
      </DashboardCard>
    </MetricsFlexGrid>
  ),
};
