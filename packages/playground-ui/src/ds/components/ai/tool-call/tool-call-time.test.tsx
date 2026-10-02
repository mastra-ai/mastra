// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ToolCallTime } from './tool-call-time';

afterEach(cleanup);

describe('ToolCallTime', () => {
  describe('when calls occur within the same minute', () => {
    it('distinguishes seconds in the visible timestamps and tooltips', () => {
      const { container } = render(
        <>
          <ToolCallTime at={new Date(2026, 8, 24, 14, 32, 5).getTime()} />
          <ToolCallTime at={new Date(2026, 8, 24, 14, 32, 58).getTime()} />
        </>,
      );
      const times = container.querySelectorAll('time');
      expect(times[0].textContent).toBe('2:32:05 PM');
      expect(times[1].textContent).toBe('2:32:58 PM');
      expect(times[0].title).toContain('2:32:05 PM');
      expect(times[1].title).toContain('2:32:58 PM');
    });
  });

  it.each([undefined, NaN, Infinity, 1e20])('omits a missing or invalid timestamp: %s', at => {
    const { container } = render(<ToolCallTime at={at} />);
    expect(container.querySelector('time')).toBeNull();
  });

  it('renders an epoch timestamp with a machine-readable date and visible time', () => {
    const { container } = render(<ToolCallTime at={0} />);
    const time = container.querySelector('time');
    expect(time?.getAttribute('datetime')).toBe('1970-01-01T00:00:00.000Z');
    expect(time?.textContent).toBeTruthy();
    expect(time?.title).toBeTruthy();
  });
});
