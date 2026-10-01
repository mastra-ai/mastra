// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DateTimeRangePicker } from './date-time-range-picker';

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
    expect(screen.getAllByRole('combobox').filter(select => select.hasAttribute('aria-invalid'))).toEqual([]);
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
