import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spinner } from './spinner';

const meta: Meta<typeof Spinner> = {
  title: 'Elements/Spinner',
  component: Spinner,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    color: {
      control: { type: 'color' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Spinner>;

export const Default: Story = {
  args: {},
};

export const White: Story = {
  args: {
    color: '#ffffff',
  },
};

export const Blue: Story = {
  args: {
    color: '#3b82f6',
  },
};

export const Green: Story = {
  args: {
    color: '#22c55e',
  },
};

export const Small: Story = {
  args: {
    className: 'h-4 w-4',
  },
};

export const Large: Story = {
  args: {
    className: 'h-8 w-8',
  },
};

export const InButton: Story = {
  render: () => (
    <button className="flex items-center gap-2 px-4 py-2 bg-surface2 border border-border1 rounded-md text-neutral6">
      <Spinner className="h-4 w-4" />
      Loading...
    </button>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner className="h-4 w-4" />
      <Spinner className="h-6 w-6" />
      <Spinner className="h-8 w-8" />
      <Spinner className="h-12 w-12" />
    </div>
  ),
};
