import type { Meta, StoryObj } from '@storybook/react-vite';
import { Fragment } from 'react';
import { Button } from '../Button/Button';
import { Field, FieldError, FieldLabel } from '../Field';
import { Txt } from '../Txt/Txt';
import { Input } from './input';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';

const meta: Meta<typeof Input> = {
  title: 'Elements/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['default', 'unstyled'],
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

export const Variants: Story = {
  render: () => (
    <div className="flex w-64 flex-col gap-3">
      <Input variant="default" placeholder="Default" />
      <Input variant="unstyled" placeholder="Unstyled" />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex w-64 flex-col gap-3">
      <Input size="sm" placeholder="Small" />
      <Input size="md" placeholder="Medium" />
      <Input size="lg" placeholder="Large" />
    </div>
  ),
};

// export const Unstyled: Story = {
// args: {
// placeholder: 'Unstyled variant',
// variant: 'unstyled',
// },
// };

// export const Small: Story = {
// args: {
// placeholder: 'Small input',
// size: 'sm',
// },
// };

// export const Large: Story = {
// args: {
// placeholder: 'Large input',
// size: 'lg',
// },
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

// Password managers stay out of DS text fields unless the field asks for them: with no
// `autoComplete`, a field renders `autocomplete="off"` plus each manager's ignore attribute.
// A credential form opts in with a real autofill token.
export const PasswordManagerAutofill: Story = {
  render: () => (
    <form className="flex w-72 flex-col gap-4" onSubmit={event => event.preventDefault()}>
      <Field>
        <FieldLabel>Name (opted out by default)</FieldLabel>
        <Input placeholder="Dataset name" />
      </Field>
      <Field>
        <FieldLabel>Email</FieldLabel>
        <Input type="email" autoComplete="email" placeholder="you@example.com" />
      </Field>
      <Field>
        <FieldLabel>Password</FieldLabel>
        <Input type="password" autoComplete="current-password" placeholder="Enter password" />
      </Field>
    </form>
  ),
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
      {(['sm', 'md', 'lg'] as const).map(size => (
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
  },
  render: args => (
    <Field invalid className="w-50">
      <FieldLabel>Email</FieldLabel>
      <Input {...args} />
      <FieldError>Enter a complete email address.</FieldError>
    </Field>
  ),
};

export const OnDifferentSurfaces: Story = {
  render: () => (
    <div className="flex w-[calc(100vw-2rem)] max-w-96 flex-col gap-4">
      <div className="rounded-lg border border-border bg-sidebar p-4">
        <Txt variant="caption" tone="muted" className="mb-2">
          Sidebar
        </Txt>
        <Input aria-label="Search agents on the sidebar" placeholder="Search agents..." />
      </div>
      <div className="rounded-lg border border-border bg-background p-4">
        <Txt variant="caption" tone="muted" className="mb-2">
          Main canvas
        </Txt>
        <Input aria-label="Search agents on the main canvas" placeholder="Search agents..." />
      </div>
      <div className={`${raisedSurfaceStyle} rounded-lg p-4`}>
        <Txt variant="caption" tone="muted" className="mb-2">
          Card
        </Txt>
        <Input aria-label="Search agents on a card" placeholder="Search agents..." />
      </div>
      <div className="rounded-lg border border-border bg-popover p-4">
        <Txt variant="caption" tone="muted" className="mb-2">
          Popover
        </Txt>
        <Input aria-label="Search agents in a popover" placeholder="Search agents..." />
      </div>
    </div>
  ),
};
