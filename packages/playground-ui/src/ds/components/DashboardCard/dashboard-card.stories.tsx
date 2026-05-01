import type { Meta, StoryObj } from '@storybook/react-vite';
import { DashboardCard } from './dashboard-card';

const meta: Meta<typeof DashboardCard> = {
  title: 'Metrics/DashboardCard',
  component: DashboardCard,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof DashboardCard>;

export const Default: Story = {
  render: () => (
    <DashboardCard>
      <p className="text-neutral3">Default dashboard card content</p>
    </DashboardCard>
  ),
};

export const WithCustomClass: Story = {
  render: () => (
    <DashboardCard className="min-w-80">
      <p className="text-neutral3">Card with custom min-width</p>
    </DashboardCard>
  ),
};

export const MultipleCards: Story = {
  render: () => (
    <div className="flex gap-4">
      <DashboardCard className="min-w-60">
        <p className="text-neutral3">Card 1</p>
      </DashboardCard>
      <DashboardCard className="min-w-60">
        <p className="text-neutral3">Card 2</p>
      </DashboardCard>
      <DashboardCard className="min-w-60">
        <p className="text-neutral3">Card 3</p>
      </DashboardCard>
    </div>
  ),
};
