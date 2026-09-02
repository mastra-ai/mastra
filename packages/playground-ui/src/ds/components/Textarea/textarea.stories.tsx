import type { Meta, StoryObj } from '@storybook/react-vite';
import { Textarea } from './textarea';

const meta: Meta<typeof Textarea> = {
  title: 'Elements/Textarea',
  component: Textarea,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'filled', 'outline', 'unstyled'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
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
    className: 'w-dropdown-max-height',
  },
};

export const Variants: Story = {
  render: () => (
    <div className="w-dropdown-max-height flex flex-col gap-3">
      <Textarea variant="default" placeholder="default" />
      <Textarea variant="filled" placeholder="filled" />
      <Textarea variant="outline" placeholder="outline" />
      <Textarea variant="unstyled" placeholder="unstyled" />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="w-dropdown-max-height flex flex-col gap-3">
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
    className: 'w-dropdown-max-height',
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled...',
    disabled: true,
    className: 'w-dropdown-max-height',
  },
};

export const OnDifferentSurfaces: Story = {
  render: () => (
    <div className="flex w-96 flex-col gap-4">
      <div className="bg-surface-primary rounded-lg border border-(--border-subtle) p-4">
        <Textarea placeholder="On bg-surface-primary" />
      </div>
      <div className="bg-surface-secondary rounded-lg border border-(--border-subtle) p-4">
        <Textarea placeholder="On bg-surface-secondary" />
      </div>
      <div className="bg-surface-raised rounded-lg border border-(--border-subtle) p-4">
        <Textarea placeholder="On bg-surface-raised" />
      </div>
      <div className="bg-surface-hover rounded-lg border border-(--border-subtle) p-4">
        <Textarea placeholder="On bg-surface-hover" />
      </div>
    </div>
  ),
};
