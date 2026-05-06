import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextFieldBlock } from './text-field-block';

const meta: Meta<typeof TextFieldBlock> = {
  title: 'FormFieldBlocks/TextFieldBlock',
  component: TextFieldBlock,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['small', 'default'],
    },
    labelSize: {
      control: { type: 'select' },
      options: ['default', 'bigger'],
    },
    layout: {
      control: { type: 'select' },
      options: ['vertical', 'horizontal'],
    },
    disabled: {
      control: { type: 'boolean' },
    },
    required: {
      control: { type: 'boolean' },
    },
    labelIsHidden: {
      control: { type: 'boolean' },
    },
    error: {
      control: { type: 'boolean' },
    },
  },
  decorators: [
    Story => (
      <div style={{ width: 320 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TextFieldBlock>;

export const Default: Story = {
  args: {
    name: 'username',
    label: 'Username',
  },
};

export const WithPlaceholder: Story = {
  args: {
    name: 'username',
    label: 'Username',
    placeholder: 'Enter your username',
  },
};

export const WithHelpText: Story = {
  args: {
    name: 'email',
    label: 'Email',
    helpText: 'We will never share your email.',
  },
};

export const WithError: Story = {
  args: {
    name: 'password',
    label: 'Password',
    error: true,
    errorMsg: 'Password must be at least 8 characters.',
  },
};

export const Required: Story = {
  args: {
    name: 'name',
    label: 'Full Name',
    required: true,
  },
};

export const Disabled: Story = {
  args: {
    name: 'readonly',
    label: 'Read Only',
    value: 'Cannot edit this',
    disabled: true,
  },
};

export const HiddenLabel: Story = {
  args: {
    name: 'search',
    label: 'Search',
    labelIsHidden: true,
  },
};

export const HorizontalLayout: Story = {
  args: {
    name: 'username',
    label: 'Username',
    layout: 'horizontal',
  },
};

export const SmallSize: Story = {
  args: {
    name: 'tag',
    label: 'Tag',
    size: 'sm',
  },
};

export const LabelSizes: Story = {
  render: () => (
    <div className="grid gap-6">
      <TextFieldBlock name="default-label" label="Default label" />
      <TextFieldBlock name="bigger-label" label="Bigger label" labelSize="bigger" />
    </div>
  ),
};

export const WithHelpTextAndError: Story = {
  args: {
    name: 'email',
    label: 'Email',
    helpText: 'Enter your work email address.',
    error: true,
    errorMsg: 'This email is already taken.',
  },
};
