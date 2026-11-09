import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, within } from 'storybook/test';

import { Button } from '../Button';
import type { DateRangePreset } from '../DateTimeRangePicker';
import { FilterBar } from '../FilterBar';
import { DEFAULT_FILTER_OPERATORS } from '../FilterBar/default-operators';
import { FILTER_BAR_TIME_RANGE_FIELD, FILTER_BAR_TIME_RANGE_ITEM } from '../FilterBar/filter-bar-time-range';
import type { FilterBarItem } from '../FilterBar/types';
import { Input } from '../Input';
import { SegmentedControl, SegmentedControlItem } from '../SegmentedControl';
import { ActionRow } from './index';

const meta: Meta<typeof ActionRow> = {
  title: 'Layout/ActionRow',
  component: ActionRow,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof ActionRow>;

export const StartOnly: Story = {
  render: () => (
    <ActionRow>
      <ActionRow.Start>
        <Input placeholder="Search" className="max-w-120" />
      </ActionRow.Start>
    </ActionRow>
  ),
};

export const StartAndEnd: Story = {
  render: () => (
    <ActionRow>
      <ActionRow.Start>
        <Input placeholder="Search" className="max-w-120" />
        <Button>Status</Button>
        <Button>Tags</Button>
      </ActionRow.Start>
      <ActionRow.End>
        <Button>Columns</Button>
        <Button variant="primary">Run</Button>
      </ActionRow.End>
    </ActionRow>
  ),
};

export const EndOnly: Story = {
  render: () => (
    <ActionRow>
      <ActionRow.End>
        <Button>Back</Button>
        <Button variant="primary">Open</Button>
      </ActionRow.End>
    </ActionRow>
  ),
};

function MonitoringRow() {
  const [items, setItems] = useState<FilterBarItem[]>([FILTER_BAR_TIME_RANGE_ITEM]);
  const [preset, setPreset] = useState<DateRangePreset>('last-24h');
  const [view, setView] = useState('requests');
  return (
    <ActionRow>
      <ActionRow.Start>
        <FilterBar
          fields={[FILTER_BAR_TIME_RANGE_FIELD, { id: 'status', label: 'Status', type: 'text' }]}
          operators={DEFAULT_FILTER_OPERATORS}
          value={items}
          onValueChange={setItems}
        >
          <FilterBar.Chips
            renderChip={item =>
              item.id === FILTER_BAR_TIME_RANGE_ITEM.id ? (
                <FilterBar.TimeRange preset={preset} onPresetChange={setPreset} />
              ) : (
                <FilterBar.Chip item={item} />
              )
            }
          />
          <FilterBar.Input placeholder="Filter requests" />
        </FilterBar>
      </ActionRow.Start>
      <ActionRow.End>
        <SegmentedControl aria-label="View" size="sm" value={view} onValueChange={setView}>
          <SegmentedControlItem value="requests">Requests</SegmentedControlItem>
          <SegmentedControlItem value="errors">Errors</SegmentedControlItem>
        </SegmentedControl>
      </ActionRow.End>
    </ActionRow>
  );
}

const rect = (scope: HTMLElement, slot: string) => {
  const element = scope.querySelector(`[data-slot="${slot}"]`);
  if (!element) throw new Error(`Missing ${slot}`);
  return element.getBoundingClientRect();
};

export const WithFilterBar: Story = {
  render: () => (
    <div className="grid gap-8">
      <div data-testid="narrow" className="w-104">
        <MonitoringRow />
      </div>
      <div data-testid="wide" className="w-240">
        <MonitoringRow />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const narrow = canvas.getByTestId('narrow');
    const narrowRow = rect(narrow, 'action-row');
    const narrowStart = rect(narrow, 'action-row-start');
    const narrowInput = rect(narrow, 'filter-bar-input-trigger');
    const narrowEnd = rect(narrow, 'action-row-end');
    await expect(narrowInput.top).toBe(narrowStart.top);
    await expect(narrowEnd.top).toBeGreaterThanOrEqual(narrowStart.bottom);
    await expect(narrowInput.right).toBe(narrowRow.right);
    await expect(narrowEnd.right).toBe(narrowRow.right);

    const wide = canvas.getByTestId('wide');
    await expect(rect(wide, 'action-row-end').top).toBeLessThan(rect(wide, 'action-row-start').bottom);
    await expect(rect(wide, 'filter-bar-input-trigger').width).toBe(320);
  },
};
