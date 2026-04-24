import type { Meta, StoryObj } from '@storybook/react-vite';
import { Plus, Settings, Trash } from 'lucide-react';
import { Button } from './Button';

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
  },
};

export const Variants: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button variant="default">Default</Button>
      <Button variant="primary">Primary</Button>
      <Button variant="cta">CTA</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button disabled variant="default">
        Default
      </Button>
      <Button disabled variant="primary">
        Primary
      </Button>
      <Button disabled variant="cta">
        CTA
      </Button>
      <Button disabled variant="ghost">
        Ghost
      </Button>
    </div>
  ),
};

export const WithIcon: Story = {
  args: {
    children: (
      <>
        <Plus />
        Add Item
      </>
    ),
  },
};

export const IconOnly: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      {(['sm', 'md', 'default', 'lg'] as const).map(size => (
        <Button key={size} size={size}>
          <Settings />
        </Button>
      ))}
    </div>
  ),
};
