import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChartSkeleton } from './chart-skeleton';

const meta: Meta<typeof ChartSkeleton> = {
  title: 'Metrics/ChartSkeleton',
  component: ChartSkeleton,
  parameters: { layout: 'centered' },
  render: args => (
    <div className="w-[min(48rem,calc(100vw-3rem))]">
      <ChartSkeleton {...args} />
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof ChartSkeleton>;

export const Bars: Story = { args: { kind: 'bar', height: 224 } };

export const Line: Story = { args: { kind: 'line', height: 224 } };
