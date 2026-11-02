import type { Meta, StoryObj } from '@storybook/react-vite';
import { Sparkline } from './sparkline';

const meta: Meta<typeof Sparkline> = {
  title: 'Metrics/Sparkline',
  component: Sparkline,
  parameters: { layout: 'centered' },
  args: {
    values: Array.from({ length: 28 }, (_, i) => 3 + 2 * Math.sin(i / 2) + (i % 5) * 0.2),
    color: 'var(--chart-green)',
  },
};

export default meta;
type Story = StoryObj<typeof Sparkline>;

export const Default: Story = {};
