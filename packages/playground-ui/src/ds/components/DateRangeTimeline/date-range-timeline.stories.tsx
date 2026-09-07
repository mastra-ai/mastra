import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { DateRangeTimeline } from './DateRangeTimeline';
import type { DateRangeValue } from './types';

const meta: Meta<typeof DateRangeTimeline> = {
  title: 'Forms/DateRangeTimeline',
  component: DateRangeTimeline,
  parameters: { layout: 'centered' },
  args: {
    min: '2026-01-01',
    max: '2026-08-26',
    value: { from: '2026-05-01', to: '2026-07-15' },
    onCommit: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof DateRangeTimeline>;

function TimelinePreview({ value: initialValue, onCommit, ...props }: React.ComponentProps<typeof DateRangeTimeline>) {
  const [value, setValue] = useState<DateRangeValue>(initialValue);

  return (
    <div className="border-border1 bg-surface2 grid w-[min(52rem,calc(100vw-3rem))] gap-5 rounded-xl border p-6">
      <div className="text-ui-sm flex items-center justify-between gap-4">
        <span className="text-neutral3">Selected range</span>
        <span className="text-neutral5 font-mono">
          {value.from} – {value.to}
        </span>
      </div>
      <DateRangeTimeline
        {...props}
        value={value}
        onCommit={nextValue => {
          setValue(nextValue);
          onCommit(nextValue);
        }}
      />
    </div>
  );
}

export const Default: Story = {
  render: args => <TimelinePreview {...args} />,
};

export const SingleDay: Story = {
  args: {
    min: '2026-08-26',
    max: '2026-08-26',
    value: { from: '2026-08-26', to: '2026-08-26' },
  },
  render: args => <TimelinePreview {...args} />,
};

export const MultiYear: Story = {
  args: {
    min: '2024-01-01',
    max: '2026-08-26',
    value: { from: '2025-02-01', to: '2026-04-15' },
  },
  render: args => <TimelinePreview {...args} />,
};
