// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    expect(presets.className).toContain('bg-transparent');
    expect(presets.className).toContain('text-neutral4');
    expect(presets.className).not.toContain('pointer-events-none');
  });

  it('returns to the fallback preset when Presets is clicked', () => {
    const { onPresetChange } = renderCustom({ presets: ['last-7d', 'custom'] });

    fireEvent.click(screen.getByRole('button', { name: /presets/i }));

    expect(onPresetChange).toHaveBeenCalledWith('last-7d');
  });

  it('renders the range error with the error token', () => {
    renderCustom({ dateFrom: new Date(2026, 0, 10), dateTo: new Date(2026, 0, 5) });

    fireEvent.click(screen.getByRole('button', { name: /apply/i }));

    const error = screen.getByText(/start date\/time must be before/i);
    expect(error.className).toContain('text-error');
    expect(error.className).not.toContain('text-red-500');
  });
});
