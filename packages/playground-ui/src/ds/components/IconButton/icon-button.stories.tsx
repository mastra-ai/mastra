import type { Meta, StoryObj } from '@storybook/react-vite';
import { IconButton } from './IconButton';
import { TooltipProvider } from '../Tooltip';
import { Settings, Plus, Trash } from 'lucide-react';

const meta: Meta<typeof IconButton> = {
  title: 'Elements/IconButton',
  component: IconButton,
  decorators: [
    Story => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'light', 'outline', 'ghost', 'primary'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    disabled: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Default: Story = {
  args: {
    children: <Settings />,
    tooltip: 'Settings',
    variant: 'default',
    size: 'md',
  },
};

export const Light: Story = {
  args: {
    children: <Settings />,
    tooltip: 'Settings',
    variant: 'light',
  },
};

export const Outline: Story = {
  args: {
    children: <Plus />,
    tooltip: 'Add item',
    variant: 'outline',
  },
};

export const Ghost: Story = {
  args: {
    children: <Trash />,
    tooltip: 'Delete',
    variant: 'ghost',
  },
};

export const Primary: Story = {
  args: {
    children: <Plus />,
    tooltip: 'Create new',
    variant: 'primary',
  },
};

export const Small: Story = {
  args: {
    children: <Settings />,
    tooltip: 'Settings',
    size: 'sm',
  },
};

export const Medium: Story = {
  args: {
    children: <Settings />,
    tooltip: 'Settings',
    size: 'md',
  },
};

export const Large: Story = {
  args: {
    children: <Settings />,
    tooltip: 'Settings',
    size: 'lg',
  },
};

export const Disabled: Story = {
  args: {
    children: <Settings />,
    tooltip: 'Settings (disabled)',
    disabled: true,
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <IconButton variant="default" tooltip="Default">
        <Settings />
      </IconButton>
      <IconButton variant="light" tooltip="Light">
        <Settings />
      </IconButton>
      <IconButton variant="outline" tooltip="Outline">
        <Settings />
      </IconButton>
      <IconButton variant="ghost" tooltip="Ghost">
        <Settings />
      </IconButton>
      <IconButton variant="primary" tooltip="Primary">
        <Settings />
      </IconButton>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <IconButton size="sm" tooltip="Small">
        <Settings />
      </IconButton>
      <IconButton size="md" tooltip="Medium">
        <Settings />
      </IconButton>
      <IconButton size="lg" tooltip="Large">
        <Settings />
      </IconButton>
    </div>
  ),
};
