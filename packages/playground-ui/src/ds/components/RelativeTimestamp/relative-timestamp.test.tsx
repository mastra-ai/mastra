// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RelativeTimestamp } from './relative-timestamp';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const now = Date.UTC(2026, 8, 24, 12, 0, 0);

describe('RelativeTimestamp', () => {
  it('shows time since, local, and UTC time in a tooltip on focus', async () => {
    vi.useFakeTimers({ now, shouldAdvanceTime: true });
    const date = new Date(now - (3 * 60 + 12) * 1000);
    const { container } = render(<RelativeTimestamp value={date} />);
    const [time] = container.getElementsByTagName('time');
    expect(time.getAttribute('dateTime')).toBe(date.toISOString());
    expect(time.querySelector('[aria-hidden]')?.textContent).toBe('3m ago');

    act(() => time.focus());
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toMatch(/3 minutes 1\d seconds ago/);
    expect(tooltip.textContent).toContain('UTC');
    expect(tooltip.textContent).toContain(
      new Intl.DateTimeFormat(undefined, {
        timeZone: 'UTC',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      }).format(date),
    );
  });

  it('keeps the visible label current', () => {
    vi.useFakeTimers({ now });
    const { container } = render(<RelativeTimestamp value={now - 59_000} />);
    const label = () => container.querySelector('[aria-hidden]')?.textContent;
    expect(label()).toBe('59s ago');
    act(() => vi.advanceTimersByTime(1000));
    expect(label()).toBe('1m ago');
  });

  it('renders nothing for an invalid date', () => {
    const { container } = render(<RelativeTimestamp value="not a date" />);
    expect(container.innerHTML).toBe('');
  });
});
