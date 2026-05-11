import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { TooltipProvider } from '../Tooltip';
import { DateTimeRangePicker } from './date-time-range-picker';
import type { DateRangePreset, DateTimeRangePickerProps } from './date-time-range-picker';

const meta: Meta<typeof DateTimeRangePicker> = {
  title: 'Composite/DateTimeRangePicker',
  component: DateTimeRangePicker,
  decorators: [
    Story => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<DateTimeRangePickerProps>;

function DateTimeRangePickerControlled(props: Partial<DateTimeRangePickerProps>) {
  const [preset, setPreset] = useState<DateRangePreset>(props.preset ?? 'all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(props.dateFrom);
  const [dateTo, setDateTo] = useState<Date | undefined>(props.dateTo);

  return (
    <DateTimeRangePicker
      {...props}
      preset={preset}
      onPresetChange={setPreset}
      dateFrom={dateFrom}
      dateTo={dateTo}
      onDateChange={(value, type) => {
        if (type === 'from') setDateFrom(value);
        else setDateTo(value);
      }}
    />
  );
}

export const Default: Story = {
  render: () => <DateTimeRangePickerControlled />,
};

export const WithPreset: Story = {
  render: () => <DateTimeRangePickerControlled preset="last-7d" />,
};

export const CustomRange: Story = {
  render: () => (
    <DateTimeRangePickerControlled preset="custom" dateFrom={new Date(2026, 2, 1)} dateTo={new Date(2026, 3, 1)} />
  ),
};

export const Disabled: Story = {
  render: () => <DateTimeRangePickerControlled disabled />,
};
