// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ToolCallTime } from './tool-call-time';

afterEach(cleanup);

describe('ToolCallTime', () => {
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
