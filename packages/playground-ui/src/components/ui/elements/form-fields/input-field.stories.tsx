import type { Meta, StoryObj } from '@storybook/react-vite';
import { InputField } from './input-field';

const meta: Meta<typeof InputField> = {
  title: 'Elements/InputField',
  component: InputField,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: { type: 'select' },
      options: ['text', 'email', 'password', 'number', 'url'],
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
  },
};

export default meta;
type Story = StoryObj<typeof InputField>;

export const Default: Story = {
  args: {
    name: 'example',
    label: 'Example Input',
    placeholder: 'Enter some text...',
  },
};

export const WithValue: Story = {
  args: {
    name: 'example',
    label: 'Input with Value',
    value: 'Hello World',
  },
};

export const Required: Story = {
  args: {
    name: 'required',
    label: 'Required Field',
    required: true,
    placeholder: 'This field is required',
  },
};

export const WithHelpMessage: Story = {
  args: {
    name: 'help',
    label: 'Input with Help',
    helpMsg: 'This is a helpful message to guide the user',
    placeholder: 'Enter your information',
  },
};

export const WithError: Story = {
  args: {
    name: 'error',
    label: 'Input with Error',
    errorMsg: 'This field is required',
    value: '',
  },
};

export const Disabled: Story = {
  args: {
    name: 'disabled',
    label: 'Disabled Input',
    value: 'Cannot edit this',
    disabled: true,
  },
};

export const HiddenLabel: Story = {
  args: {
    name: 'hidden-label',
    label: 'Hidden Label',
    labelIsHidden: true,
    placeholder: 'Label is hidden but accessible',
  },
};

export const Email: Story = {
  args: {
    name: 'email',
    label: 'Email Address',
    type: 'email',
    placeholder: 'Enter your email',
  },
};

export const Password: Story = {
  args: {
    name: 'password',
    label: 'Password',
    type: 'password',
    placeholder: 'Enter your password',
  },
};

export const Number: Story = {
  args: {
    name: 'age',
    label: 'Age',
    type: 'number',
    placeholder: 'Enter your age',
  },
};
