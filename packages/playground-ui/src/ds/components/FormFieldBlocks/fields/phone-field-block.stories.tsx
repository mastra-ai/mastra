import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { PhoneFieldBlock } from './phone-field-block';
import type { PhoneFieldBlockProps } from './phone-field-block';

function PhoneFieldBlockControlled(props: PhoneFieldBlockProps) {
  const [value, setValue] = useState(props.value ?? '');

  return <PhoneFieldBlock {...props} value={value} onValueChange={setValue} />;
}

const meta: Meta<typeof PhoneFieldBlock> = {
  title: 'FormFieldBlocks/PhoneFieldBlock',
  component: PhoneFieldBlock,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
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
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
  render: args => <PhoneFieldBlockControlled {...args} />,
};

export default meta;
type Story = StoryObj<typeof PhoneFieldBlock>;

export const Default: Story = {
  args: {
    name: 'phone',
    label: 'Phone number',
    helpText: 'Include a country code.',
  },
};

export const Required: Story = {
  args: {
    name: 'phone-required',
    label: 'Phone number',
    required: true,
    value: '+14155552671',
  },
};

export const Error: Story = {
  args: {
    name: 'phone-error',
    label: 'Phone number',
    value: '+1415',
    errorMsg: 'Enter a valid phone number.',
  },
};
