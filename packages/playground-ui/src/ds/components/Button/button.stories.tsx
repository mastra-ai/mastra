import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';
import { Plus, Settings, Trash } from 'lucide-react';

const meta: Meta<typeof Button> = {
  title: 'Elements/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'light', 'outline', 'ghost'],
    },
    size: {
      control: { type: 'select' },
      options: ['md', 'lg'],
    },
    disabled: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: 'Button',
    variant: 'default',
    size: 'md',
  },
};

export const Light: Story = {
  args: {
    children: 'Light Button',
    variant: 'light',
  },
};

export const Outline: Story = {
  args: {
    children: 'Outline Button',
    variant: 'outline',
  },
};

export const Ghost: Story = {
  args: {
    children: 'Ghost Button',
    variant: 'ghost',
  },
};

export const Large: Story = {
  args: {
    children: 'Large Button',
    size: 'lg',
  },
};

export const Disabled: Story = {
  args: {
    children: 'Disabled Button',
    disabled: true,
  },
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Plus className="h-4 w-4" />
        Add Item
      </>
    ),
  },
};

export const IconOnly: Story = {
  args: {
    children: <Settings className="h-4 w-4" />,
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Button variant="default">Default</Button>
      <Button variant="light">Light</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};
