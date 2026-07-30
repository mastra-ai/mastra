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
      <div className="border-border1 bg-surface1 rounded-lg border p-4">
        <Textarea placeholder="On bg-surface1" />
      </div>
      <div className="border-border1 bg-surface2 rounded-lg border p-4">
        <Textarea placeholder="On bg-surface2" />
      </div>
      <div className="border-border1 bg-surface3 rounded-lg border p-4">
        <Textarea placeholder="On bg-surface3" />
      </div>
      <div className="border-border1 bg-surface4 rounded-lg border p-4">
        <Textarea placeholder="On bg-surface4" />
      </div>
    </div>
  ),
};
