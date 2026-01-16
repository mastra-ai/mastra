import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';
import { Check, AlertCircle, Info as InfoIcon } from 'lucide-react';

const meta: Meta<typeof Badge> = {
  title: 'Elements/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'success', 'error', 'info'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    children: 'Badge',
    variant: 'default',
  },
};

export const Success: Story = {
  args: {
    children: 'Success',
    variant: 'success',
  },
};

export const Error: Story = {
  args: {
    children: 'Error',
    variant: 'error',
  },
};

export const Info: Story = {
  args: {
    children: 'Info',
    variant: 'info',
  },
};

export const WithIcon: Story = {
  args: {
    children: 'Completed',
    icon: <Check className="h-3 w-3" />,
    variant: 'success',
  },
};

export const WithErrorIcon: Story = {
  args: {
    children: 'Failed',
    icon: <AlertCircle className="h-3 w-3" />,
    variant: 'error',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="error">Error</Badge>
      <Badge variant="info">Info</Badge>
    </div>
  ),
};
