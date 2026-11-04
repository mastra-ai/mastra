import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { TooltipProvider } from '../Tooltip';
import { CustomRangeEditor } from './custom-range-editor';
import { DateTimeRangePicker } from './date-time-range-picker';
import type { DateRangePreset, DateTimeRangePickerProps } from './date-time-range-picker';
import { overlaySurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

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

/** The custom range popover body on its own, open, so it can be judged without clicking through. */
export const RangeEditor: Story = {
  render: () => (
    <div className={cn('rounded-xl', overlaySurfaceStyle)}>
      <CustomRangeEditor
        dateFrom={new Date(2026, 10, 9)}
        dateTo={new Date(2026, 10, 17, 23, 59)}
        onApply={() => {}}
        onShowPresets={() => {}}
      />
    </div>
  ),
};

const PERIOD_START = new Date(2026, 9, 11, 10, 28);

/**
 * `namedRanges`: fixed ranges above the presets, here the current billing period. While one is
 * applied, the trigger shows its name instead of the dates.
 */
export const NamedRange: Story = {
  render: () => (
    <DateTimeRangePickerControlled
      preset="custom"
      dateFrom={PERIOD_START}
      presets={['last-7d', 'last-30d', 'custom']}
      namedRanges={[{ label: 'This period', from: PERIOD_START }]}
    />
  ),
};
