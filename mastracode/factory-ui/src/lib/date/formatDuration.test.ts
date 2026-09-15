import { describe, expect, it } from 'vitest';

import { formatDuration } from './formatDuration';

describe('formatDuration', () => {
  it('renders an em dash for missing or invalid input', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
    expect(formatDuration(Number.NaN)).toBe('—');
    expect(formatDuration(-1)).toBe('—');
  });

  it('renders seconds under a minute', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45_000)).toBe('45s');
  });

  it('renders whole minutes under an hour', () => {
    expect(formatDuration(60_000)).toBe('1m');
    expect(formatDuration(59 * 60_000 + 59_000)).toBe('59m');
  });

  it('renders hours with a minute remainder', () => {
    expect(formatDuration(3 * 3_600_000)).toBe('3h');
    expect(formatDuration(3 * 3_600_000 + 20 * 60_000)).toBe('3h 20m');
  });

  it('renders days with an hour remainder', () => {
    expect(formatDuration(2 * 86_400_000)).toBe('2d');
    expect(formatDuration(2 * 86_400_000 + 4 * 3_600_000)).toBe('2d 4h');
  });
});
