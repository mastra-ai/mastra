import type { Meta, StoryObj } from '@storybook/react-vite';
import { Textarea } from './textarea';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';

const meta: Meta<typeof Textarea> = {
  title: 'Elements/Textarea',
  component: Textarea,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'outline', 'unstyled'],
    },
    size: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'md', 'lg'],
    },
    disabled: {
      control: { type: 'boolean' },
    },
    error: {
      control: { type: 'boolean' },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  args: {
    placeholder: 'Type something...',
    className: 'w-75',
  },
};

export const Variants: Story = {
  render: () => (
    <div className="w-75 flex flex-col gap-3">
      <Textarea variant="default" placeholder="default" />
      <Textarea variant="outline" placeholder="outline" />
      <Textarea variant="unstyled" placeholder="unstyled" />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="w-75 flex flex-col gap-3">
      <Textarea size="xs" placeholder="xs" />
      <Textarea size="sm" placeholder="sm" />
      <Textarea size="md" placeholder="md" />
      <Textarea size="lg" placeholder="lg" />
    </div>
  ),
};

export const Error: Story = {
  args: {
    placeholder: 'Invalid input...',
    error: true,
    className: 'w-75',
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled...',
    disabled: true,
    className: 'w-75',
  },
};

export const OnDifferentSurfaces: Story = {
  render: () => (
    <div className="flex w-96 flex-col gap-4">
      <div className="border-border bg-sidebar rounded-lg border p-4">
        <Textarea placeholder="On bg-sidebar" />
      </div>
      <div className="border-border bg-background rounded-lg border p-4">
        <Textarea placeholder="On bg-background" />
      </div>
      <div className={`${raisedSurfaceStyle} rounded-lg p-4`}>
        <Textarea placeholder="On bg-card" />
      </div>
      <div className="border-border bg-muted rounded-lg border p-4">
        <Textarea placeholder="On bg-muted" />
      </div>
    </div>
  ),
};
