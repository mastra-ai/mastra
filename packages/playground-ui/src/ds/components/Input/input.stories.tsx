import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './input';

const meta: Meta<typeof Input> = {
  title: 'Elements/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'filled', 'unstyled'],
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
    },
    disabled: {
      control: { type: 'boolean' },
    },
    type: {
      control: { type: 'select' },
      options: ['text', 'email', 'password', 'number', 'url'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
    variant: 'default',
  },
};

export const Filled: Story = {
  args: {
    placeholder: 'Filled variant',
    variant: 'filled',
  },
};

export const Unstyled: Story = {
  args: {
    placeholder: 'Unstyled variant',
    variant: 'unstyled',
  },
};

export const Small: Story = {
  args: {
    placeholder: 'Small input',
    size: 'sm',
  },
};

export const Large: Story = {
  args: {
    placeholder: 'Large input',
    size: 'lg',
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled input',
    disabled: true,
    value: 'Cannot edit',
  },
};

export const WithValue: Story = {
  args: {
    value: 'Hello World',
  },
};

export const Email: Story = {
  args: {
    type: 'email',
    placeholder: 'email@example.com',
  },
};

export const Password: Story = {
  args: {
    type: 'password',
    placeholder: 'Enter password',
  },
};

export const Number: Story = {
  args: {
    type: 'number',
    placeholder: '0',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-3 w-64">
      <Input variant="default" placeholder="Default" />
      <Input variant="filled" placeholder="Filled" />
      <Input variant="unstyled" placeholder="Unstyled" />
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3 w-64">
      <Input size="sm" placeholder="Small" />
      <Input size="md" placeholder="Medium" />
      <Input size="lg" placeholder="Large" />
    </div>
  ),
};
