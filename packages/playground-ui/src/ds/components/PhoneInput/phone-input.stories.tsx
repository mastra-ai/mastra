import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Txt } from '../Txt';
import { PhoneInput } from './phone-input';

const meta: Meta<typeof PhoneInput> = {
  title: 'Composite/PhoneInput',
  component: PhoneInput,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof PhoneInput>;

function ControlledPhoneInput({ initialValue = '' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);

  return (
    <div className="flex w-56 flex-col gap-2">
      <PhoneInput aria-label="Phone number" value={value} onValueChange={setValue} />
      <Txt variant="caption" tone="muted">
        {value || 'No phone number'}
      </Txt>
    </div>
  );
}

export const Default: Story = {
  render: () => <ControlledPhoneInput />,
};

export const InternationalValue: Story = {
  render: () => <ControlledPhoneInput initialValue="+442079460018" />,
};

export const Sizes: Story = {
  render: () => (
    <div className="flex w-56 flex-col gap-3">
      <PhoneInput aria-label="Small phone number" size="sm" />
      <PhoneInput aria-label="Medium phone number" size="md" />
      <PhoneInput aria-label="Large phone number" size="lg" />
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    'aria-label': 'Phone number',
    value: '+14155552671',
    disabled: true,
  },
};

export const Error: Story = {
  args: {
    'aria-label': 'Phone number',
    defaultValue: '+1415',
    error: true,
  },
};
