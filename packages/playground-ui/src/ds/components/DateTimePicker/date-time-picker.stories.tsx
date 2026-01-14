import type { Meta, StoryObj } from '@storybook/react-vite';
import { DateTimePicker } from './date-time-picker';
import { useState } from 'react';

const meta: Meta<typeof DateTimePicker> = {
  title: 'Composite/DateTimePicker',
  component: DateTimePicker,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DateTimePicker>;

const DateTimePickerDemo = ({ initialValue }: { initialValue?: Date }) => {
  const [value, setValue] = useState<Date | undefined>(initialValue);

  return (
    <div className="w-[280px]">
      <DateTimePicker value={value} onValueChange={setValue} />
      {value && <p className="mt-2 text-sm text-icon5">Selected: {value.toLocaleString()}</p>}
    </div>
  );
};

export const Default: Story = {
  render: () => <DateTimePickerDemo />,
};

export const WithValue: Story = {
  render: () => <DateTimePickerDemo initialValue={new Date()} />,
};

export const WithPlaceholder: Story = {
  render: () => {
    const [value, setValue] = useState<Date | undefined>();
    return (
      <div className="w-[280px]">
        <DateTimePicker value={value} onValueChange={setValue} placeholder="Select date and time..." />
      </div>
    );
  },
};

export const WithMinValue: Story = {
  render: () => {
    const [value, setValue] = useState<Date | undefined>();
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - 7);

    return (
      <div className="w-[280px]">
        <DateTimePicker
          value={value}
          onValueChange={setValue}
          minValue={minDate}
          placeholder="Select a date (min: 7 days ago)"
        />
      </div>
    );
  },
};

export const WithMaxValue: Story = {
  render: () => {
    const [value, setValue] = useState<Date | undefined>();
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 7);

    return (
      <div className="w-[280px]">
        <DateTimePicker
          value={value}
          onValueChange={setValue}
          maxValue={maxDate}
          placeholder="Select a date (max: 7 days ahead)"
        />
      </div>
    );
  },
};

export const WithDefaultTime: Story = {
  render: () => {
    const [value, setValue] = useState<Date | undefined>();

    return (
      <div className="w-[280px]">
        <DateTimePicker value={value} onValueChange={setValue} defaultTimeStrValue="09:00 AM" />
      </div>
    );
  },
};
