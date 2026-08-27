import type { Meta, StoryObj } from '@storybook/react-vite';

import { StatusBadge } from './StatusBadge';

const meta: Meta<typeof StatusBadge> = {
  title: 'Elements/StatusBadge',
  component: StatusBadge,
  parameters: { layout: 'centered' },
  args: {
    children: 'Running',
    variant: 'success',
    size: 'md',
    withDot: true,
    pulse: false,
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['success', 'warning', 'error', 'info', 'neutral'] },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
  },
};

export default meta;
type Story = StoryObj<typeof StatusBadge>;

export const Default: Story = {};

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <StatusBadge variant="success" withDot>
        Completed
      </StatusBadge>
      <StatusBadge variant="warning" withDot>
        Waiting
      </StatusBadge>
      <StatusBadge variant="error" withDot>
        Failed
      </StatusBadge>
      <StatusBadge variant="info" withDot>
        Running
      </StatusBadge>
      <StatusBadge variant="neutral" withDot>
        Draft
      </StatusBadge>
    </div>
  ),
};

export const SizesAndPulse: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <StatusBadge size="sm" variant="info" withDot pulse>
        Streaming
      </StatusBadge>
      <StatusBadge size="md" variant="info" withDot pulse>
        Streaming
      </StatusBadge>
      <StatusBadge size="lg" variant="info" withDot pulse>
        Streaming
      </StatusBadge>
    </div>
  ),
};
