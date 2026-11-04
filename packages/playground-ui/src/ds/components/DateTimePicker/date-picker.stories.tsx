import type { Meta, StoryObj } from '@storybook/react-vite';
import { addDays } from 'date-fns';
import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { DatePicker } from './date-picker';
import { overlaySurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

const meta: Meta<typeof DatePicker> = {
  title: 'Elements/Calendar',
  component: DatePicker,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    Story => (
      <div className={cn('rounded-xl', overlaySurfaceStyle)}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DatePicker>;

const today = new Date();

export const Single: Story = {
  render: () => {
    const [selected, setSelected] = useState<Date | undefined>(addDays(today, 2));
    return <DatePicker mode="single" selected={selected} onSelect={setSelected} />;
  },
};

export const Range: Story = {
  render: () => {
    const [range, setRange] = useState<DateRange | undefined>({ from: addDays(today, -12), to: addDays(today, -2) });
    return (
      <DatePicker
        mode="range"
        numberOfMonths={2}
        resetOnSelect
        defaultMonth={addDays(today, -31)}
        selected={range}
        onSelect={setRange}
      />
    );
  },
};

export const DisabledDays: Story = {
  render: () => {
    const [selected, setSelected] = useState<Date | undefined>();
    return (
      <DatePicker
        mode="single"
        selected={selected}
        onSelect={setSelected}
        disabled={[{ dayOfWeek: [0, 6] }, { after: today }]}
      />
    );
  },
};
