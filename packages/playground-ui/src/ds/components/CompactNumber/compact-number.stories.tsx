import type { Meta, StoryObj } from '@storybook/react-vite';
import { CompactNumber } from './compact-number';

const meta: Meta<typeof CompactNumber> = {
  title: 'Elements/CompactNumber',
  component: CompactNumber,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof CompactNumber>;

export const Default: Story = {
  args: {
    value: 12310,
  },
};

export const Money: Story = {
  args: {
    value: 12345.67,
    currency: 'USD',
  },
};
