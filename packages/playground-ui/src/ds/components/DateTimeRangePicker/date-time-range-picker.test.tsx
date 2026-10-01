// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DateTimeRangePicker } from './date-time-range-picker';

afterEach(cleanup);

function renderCustom(props: Partial<React.ComponentProps<typeof DateTimeRangePicker>> = {}) {
  const onPresetChange = vi.fn();
  render(<DateTimeRangePicker preset="custom" onPresetChange={onPresetChange} {...props} />);
  // Trigger label is "Start – End" or the formatted dates; it is the only button before the popover opens.
  fireEvent.click(screen.getByRole('button'));
  return { onPresetChange };
}

describe('DateTimeRangePicker (custom range popover)', () => {
  it('renders the Presets link as a ghost design-system Button', () => {
    renderCustom();

    const presets = screen.getByRole('button', { name: /presets/i });
    expect(presets.tagName).toBe('BUTTON');
    expect(presets.getAttribute('data-variant')).toBe('ghost');
    // Unprefixed only: the recipe carries aria-disabled:pointer-events-none, which a
    // substring match would catch even though it never applies to an enabled control.
    expect(presets.className).not.toMatch(/(^|\s)pointer-events-none(\s|$)/);
  });

  it('returns to the fallback preset when Presets is clicked', () => {
    const { onPresetChange } = renderCustom({ presets: ['last-7d', 'custom'] });

    fireEvent.click(screen.getByRole('button', { name: /presets/i }));

    expect(onPresetChange).toHaveBeenCalledWith('last-7d');
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
