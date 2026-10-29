import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import type { DateRangePreset } from '@/ds/components/DateTimeRangePicker';
import { FilterBarTimeRange, FILTER_BAR_TIME_RANGE_FIELD, FilterBar } from '@/ds/components/FilterBar';
import { DEFAULT_FILTER_OPERATORS } from '@/ds/components/FilterBar/default-operators';
import type { FilterBarItem } from '@/ds/components/FilterBar/types';

const meta: Meta<typeof FilterBarTimeRange> = {
  title: 'Composite/FilterBar/TimeRange',
  component: FilterBarTimeRange,
  parameters: {
    docs: {
      description: {
        component:
          "A filter bar's time range: the same calendar control as `DateTimeRangePicker`, as the one chip a bar always carries. It is rendered with `removable={false}`, so its trigger is the last thing in the chip — and the segment whose end cap a framework can take away: opening the picker wraps the trigger in focus guards, which is what a `:last-child` rounding rule would silently lose. Open the picker in this story to check the open segment still ends on the pill.",
      },
    },
  },
};
export default meta;

function Bar({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<FilterBarItem[]>([]);
  return (
    <FilterBar
      fields={[FILTER_BAR_TIME_RANGE_FIELD, { id: 'status', label: 'Status', type: 'text' }]}
      operators={DEFAULT_FILTER_OPERATORS}
      value={items}
      onValueChange={setItems}
    >
      {children}
      <FilterBar.Chips />
      <FilterBar.Input placeholder="Filter traces" />
    </FilterBar>
  );
}

export const Default: StoryObj = {
  render: () => {
    const [preset, setPreset] = useState<DateRangePreset>('last-7d');
    return (
      <Bar>
        <FilterBar.TimeRange preset={preset} onPresetChange={setPreset} />
      </Bar>
    );
  },
};

export const CustomRange: StoryObj = {
  render: () => {
    const [preset, setPreset] = useState<DateRangePreset>('custom');
    const [from, setFrom] = useState<Date | undefined>(new Date('2026-06-01T09:00:00Z'));
    const [to, setTo] = useState<Date | undefined>(new Date('2026-06-08T18:30:00Z'));
    return (
      <Bar>
        <FilterBar.TimeRange
          preset={preset}
          onPresetChange={setPreset}
          dateFrom={from}
          dateTo={to}
          onDateRangeChange={(nextFrom, nextTo) => {
            setFrom(nextFrom);
            setTo(nextTo);
          }}
          onDateChange={(date, side) => (side === 'from' ? setFrom(date) : setTo(date))}
        />
      </Bar>
    );
  },
};

export const Disabled: StoryObj = {
  render: () => (
    <Bar>
      <FilterBar.TimeRange preset="last-7d" disabled />
    </Bar>
  ),
};
