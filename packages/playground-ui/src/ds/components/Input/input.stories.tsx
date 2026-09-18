import type { Meta, StoryObj } from '@storybook/react-vite';
import { Fragment } from 'react';
import { Button } from '../Button/Button';
import { Input } from './input';

const meta: Meta<typeof Input> = {
  title: 'Elements/Input',
  component: Input,
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

export const Variants: Story = {
  render: () => (
    <div className="flex w-64 flex-col gap-3">
      <Input variant="default" placeholder="Default" />
      <Input variant="outline" placeholder="Outline" />
      <Input variant="unstyled" placeholder="Unstyled" />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex w-64 flex-col gap-3">
      <Input size="xs" placeholder="Extra Small" />
      <Input size="sm" placeholder="Small" />
      <Input size="md" placeholder="Medium" />
      <Input size="lg" placeholder="Large" />
    </div>
  ),
};

export const Outline: Story = {
  args: {
    placeholder: 'Outline variant',
    variant: 'outline',
  },
};

// export const Unstyled: Story = {
//   args: {
//     placeholder: 'Unstyled variant',
//     variant: 'unstyled',
//   },
// };

// export const Small: Story = {
//   args: {
//     placeholder: 'Small input',
//     size: 'sm',
//   },
// };

// export const Large: Story = {
//   args: {
//     placeholder: 'Large input',
//     size: 'lg',
//   },
// };

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

export const SizesWithButton: Story = {
  render: () => (
    <div className="grid grid-cols-[200px_auto] items-center gap-3">
      {(['xs', 'sm', 'md', 'lg'] as const).map(size => (
        <Fragment key={size}>
          <Input size={size} placeholder={size} />
          <Button size={size} className="justify-self-start">
            Button
          </Button>
        </Fragment>
      ))}
    </div>
  ),
};

export const Error: Story = {
  args: {
    placeholder: 'invalid@',
    defaultValue: 'invalid@',
    error: true,
  },
};

export const OnDifferentSurfaces: Story = {
  render: () => (
    <div className="new-theme flex w-96 flex-col gap-4">
      <div className="border-border bg-sidebar rounded-lg border p-4">
        <Input placeholder="On bg-sidebar (recessed)" />
      </div>
      <div className="border-border bg-background rounded-lg border p-4">
        <Input placeholder="On bg-background" />
      </div>
      <div className="border-border bg-card rounded-lg border p-4">
        <Input placeholder="On bg-card" />
      </div>
      <div className="border-border bg-muted rounded-lg border p-4">
        <Input placeholder="On bg-muted (raised)" />
      </div>
    </div>
  ),
};
