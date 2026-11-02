// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DateTimeRangePicker } from './date-time-range-picker';
import type { DateRangePreset } from './date-time-range-picker';

afterEach(cleanup);

function renderCustom(props: Partial<React.ComponentProps<typeof DateTimeRangePicker>> = {}) {
  const onPresetChange = vi.fn();
  render(<DateTimeRangePicker preset="custom" onPresetChange={onPresetChange} {...props} />);
  fireEvent.click(screen.getByRole('button'));
  return { onPresetChange };
}

describe('DateTimeRangePicker (custom range popover)', () => {
  it('renders the Presets link as a ghost design-system Button', () => {
    renderCustom();

    const presets = screen.getByRole('button', { name: /presets/i });
    expect(presets.tagName).toBe('BUTTON');
    expect(presets.getAttribute('data-variant')).toBe('ghost');
    // the recipe's aria-disabled:pointer-events-none would satisfy a substring match
    expect(presets.className).not.toMatch(/(^|\s)pointer-events-none(\s|$)/);
  });

  it('keeps an applied custom range when going back to Presets, with Custom range checked', () => {
    const { onPresetChange } = renderCustom({
      dateFrom: new Date(2026, 0, 5),
      dateTo: new Date(2026, 0, 10),
      presets: TRACE_PRESETS,
    });

    fireEvent.click(screen.getByRole('button', { name: /presets/i }));

    expect(onPresetChange).not.toHaveBeenCalled();
    expect(checkedPreset()).toBe('Custom range...');
  });

  it('renders the range error with the shared field message', () => {
    renderCustom({ dateFrom: new Date(2026, 0, 10), dateTo: new Date(2026, 0, 5) });

    fireEvent.click(screen.getByRole('button', { name: /apply/i }));

    const error = screen.getByRole('alert');
    expect(error.textContent).toContain('Start date/time must be before end date/time');
    expect(error.querySelector('[data-slot="icon"] svg')).not.toBeNull();

    const range = screen.getByRole('group', { name: 'Custom date range' });
    expect(range.getAttribute('aria-invalid')).toBe('true');
    expect(range.getAttribute('aria-describedby')).toBe(error.id);
    expect(screen.getAllByRole('combobox').filter(select => select.hasAttribute('aria-invalid'))).toEqual([]);
  });

  it('clears the range error once the range is fixed', () => {
    renderCustom({ dateFrom: new Date(2026, 0, 10), dateTo: new Date(2026, 0, 5) });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(screen.queryByRole('alert')).not.toBeNull();

    const [startCalendarDay] = screen.getAllByRole('gridcell', { name: '4' });
    fireEvent.click(startCalendarDay);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('group', { name: 'Custom date range' }).getAttribute('aria-invalid')).toBeNull();
  });

  it('rejects a custom range wider than maxRangeMs', () => {
    const onDateRangeChange = vi.fn();
    renderCustom({
      dateFrom: new Date(2026, 8, 1),
      dateTo: new Date(2026, 11, 31),
      maxRangeMs: 31 * 24 * 60 * 60 * 1000,
      onDateRangeChange,
    });

    fireEvent.click(screen.getByRole('button', { name: /apply/i }));

    expect(screen.getByRole('alert').textContent).toContain('Range cannot be longer than 31 days');
    expect(onDateRangeChange).not.toHaveBeenCalled();
  });

  it('applies a custom range within maxRangeMs', () => {
    const onDateRangeChange = vi.fn();
    renderCustom({
      dateFrom: new Date(2026, 8, 1),
      dateTo: new Date(2026, 8, 20),
      maxRangeMs: 31 * 24 * 60 * 60 * 1000,
      onDateRangeChange,
    });

    fireEvent.click(screen.getByRole('button', { name: /apply/i }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(onDateRangeChange).toHaveBeenCalledTimes(1);
  });

  it('disables days before minDate in both calendars', () => {
    const onDateRangeChange = vi.fn();
    renderCustom({
      dateFrom: new Date(2026, 8, 20),
      dateTo: new Date(2026, 8, 25),
      minDate: new Date(2026, 8, 15, 13, 30),
      onDateRangeChange,
    });

    const [startCalendar, endCalendar] = screen.getAllByRole('grid');
    // Each calendar shows September; the 14th is the last day before minDate.
    for (const calendar of [startCalendar, endCalendar]) {
      const [day14] = within(calendar).getAllByRole('gridcell', { name: '14' });
      expect(day14.hasAttribute('disabled')).toBe(true);
    }
    const [day15] = within(startCalendar).getAllByRole('gridcell', { name: '15' });
    expect(day15.hasAttribute('disabled')).toBe(false);

    fireEvent.click(within(startCalendar).getAllByRole('gridcell', { name: '14' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    const [[from]] = onDateRangeChange.mock.calls;
    expect(from.getDate()).toBe(20);
  });

  it('keeps the end calendar from minDate when the draft start is earlier', () => {
    renderCustom({
      dateFrom: new Date(2026, 8, 1),
      dateTo: new Date(2026, 8, 20),
      minDate: new Date(2026, 8, 15, 13, 30),
    });

    const [, endCalendar] = screen.getAllByRole('grid');
    const [day14] = within(endCalendar).getAllByRole('gridcell', { name: '14' });
    expect(day14.hasAttribute('disabled')).toBe(true);
  });

  it('applies a range that starts on the minDate day when minDate carries a time', () => {
    const onDateRangeChange = vi.fn();
    renderCustom({
      dateFrom: new Date(2026, 8, 15),
      dateTo: new Date(2026, 8, 20),
      minDate: new Date(2026, 8, 15, 13, 30),
      onDateRangeChange,
    });

    fireEvent.click(screen.getByRole('button', { name: /apply/i }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(onDateRangeChange).toHaveBeenCalledTimes(1);
  });

  it('rejects a range that already starts before minDate', () => {
    const onDateRangeChange = vi.fn();
    renderCustom({
      dateFrom: new Date(2026, 8, 1),
      dateTo: new Date(2026, 8, 20),
      minDate: new Date(2026, 8, 15, 13, 30),
      onDateRangeChange,
    });

    fireEvent.click(screen.getByRole('button', { name: /apply/i }));

    expect(screen.getByRole('alert').textContent).toContain('Range cannot start before Sep 15, 2026');
    expect(onDateRangeChange).not.toHaveBeenCalled();
  });

  it('starts the range editor fresh each time it opens', () => {
    renderCustom({ dateFrom: new Date(2026, 0, 10), dateTo: new Date(2026, 0, 5) });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(screen.queryByRole('alert')).not.toBeNull();

    const trigger = screen.getAllByRole('button').find(button => button.getAttribute('aria-haspopup') === 'dialog');
    if (!trigger) throw new Error('missing range trigger');
    fireEvent.click(trigger);
    fireEvent.click(trigger);

    expect(screen.getByRole('group', { name: 'Custom date range' }).getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('names each time select on its own, with its own id', () => {
    renderCustom();

    const selects = ['Start time', 'End time'].flatMap(time => {
      const group = screen.getByRole('group', { name: time });
      return ['Hour', 'Minute', 'AM or PM'].map(part => within(group).getByRole('combobox', { name: part }));
    });

    expect(new Set(selects.map(select => select.id)).size).toBe(6);
  });
});

describe('DateTimeRangePicker (custom range label)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T12:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const label = (dateFrom?: Date, dateTo?: Date) => {
    render(<DateTimeRangePicker preset="custom" dateFrom={dateFrom} dateTo={dateTo} />);
    return screen.getByRole('button').textContent;
  };

  describe('when the range sits within one day', () => {
    it('shows the day once, then both times', () => {
      expect(label(new Date('2026-10-21T14:05:00.000Z'), new Date('2026-10-21T16:00:00.000Z'))).toBe(
        'Oct 21, 2:05 PM \u2013 4 PM',
      );
    });
  });

  describe('when the range spans several days', () => {
    it('shows the day and time of each end', () => {
      expect(label(new Date('2026-10-20T00:00:00.000Z'), new Date('2026-10-27T09:30:00.000Z'))).toBe(
        'Oct 20, 12 AM \u2013 Oct 27, 9:30 AM',
      );
    });
  });

  describe('when the range reaches outside the current year', () => {
    it('adds the year to both ends', () => {
      expect(label(new Date('2025-12-30T22:00:00.000Z'), new Date('2026-01-02T06:00:00.000Z'))).toBe(
        'Dec 30, 2025, 10 PM \u2013 Jan 2, 2026, 6 AM',
      );
    });
  });

  describe('when an end is open', () => {
    it('names the open end', () => {
      expect(label(new Date('2026-10-21T14:00:00.000Z'), undefined)).toBe('Oct 21, 2 PM \u2013 End');
    });
  });
});

const TRACE_PRESETS: readonly DateRangePreset[] = ['last-24h', 'last-3d', 'last-7d', 'last-14d', 'last-30d', 'custom'];

/** Owns the preset like a real consumer (e.g. the Traces URL state) so preset switches re-render. */
function ControlledPicker({ initialPreset }: { initialPreset: DateRangePreset }) {
  const [preset, setPreset] = useState(initialPreset);
  return <DateTimeRangePicker preset={preset} onPresetChange={setPreset} presets={TRACE_PRESETS} />;
}

function checkedPreset() {
  return screen
    .getAllByRole('menuitemradio')
    .filter(item => item.getAttribute('aria-checked') === 'true')
    .map(item => item.textContent)
    .join(', ');
}

describe('DateTimeRangePicker (presets)', () => {
  it('checks the current preset in the preset list', () => {
    render(<ControlledPicker initialPreset="last-3d" />);

    fireEvent.click(screen.getByRole('button', { name: 'Last 3 days' }));

    expect(checkedPreset()).toBe('Last 3 days');
  });

  it('returns to the preset you came from when leaving the custom range', () => {
    render(<ControlledPicker initialPreset="last-3d" />);

    fireEvent.click(screen.getByRole('button', { name: 'Last 3 days' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Custom range...' }));
    fireEvent.click(screen.getByRole('button', { name: /presets/i }));

    expect(screen.getByRole('button', { name: 'Last 3 days' })).toBeTruthy();
    expect(checkedPreset()).toBe('Last 3 days');
  });
});

/** Applies "custom" at once but leaves other presets pending, like a router that commits URL changes later. */
function SlowPicker({ onPendingPreset }: { onPendingPreset: (preset: DateRangePreset) => void }) {
  const [preset, setPreset] = useState<DateRangePreset>('last-3d');
  return (
    <DateTimeRangePicker
      preset={preset}
      onPresetChange={next => (next === 'custom' ? setPreset(next) : onPendingPreset(next))}
      presets={TRACE_PRESETS}
    />
  );
}

describe('DateTimeRangePicker (presets restored by a slow parent)', () => {
  it('shows the restored preset right away, before the parent applies it', () => {
    const onPendingPreset = vi.fn();
    render(<SlowPicker onPendingPreset={onPendingPreset} />);

    fireEvent.click(screen.getByRole('button', { name: 'Last 3 days' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Custom range...' }));
    fireEvent.click(screen.getByRole('button', { name: /presets/i }));

    expect(onPendingPreset).toHaveBeenCalledWith('last-3d');
    expect(screen.getByRole('button', { name: 'Last 3 days' })).toBeTruthy();
    expect(checkedPreset()).toBe('Last 3 days');
  });
});
