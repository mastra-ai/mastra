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
    expect(presets.className).toContain('text-muted-foreground');
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
    expect(error.className).toContain('text-foreground');
    expect(error.className).toContain('[&>svg]:text-destructive');
  });
});
