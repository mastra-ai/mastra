import { describe, expect, it } from 'vitest';
import { formatDuration } from '../format-duration.js';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatDuration', () => {
  it('shows the two largest units, space-separated', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(59 * SECOND)).toBe('59s');
    expect(formatDuration(61 * SECOND)).toBe('1m 1s');
    expect(formatDuration(80 * MINUTE + 30 * SECOND)).toBe('1h 20m');
    expect(formatDuration(2 * DAY + 3 * HOUR + 5 * MINUTE)).toBe('2d 3h');
  });

  it('drops a zero second unit', () => {
    expect(formatDuration(MINUTE)).toBe('1m');
    expect(formatDuration(HOUR + 30 * SECOND)).toBe('1h');
    expect(formatDuration(DAY + 5 * MINUTE)).toBe('1d');
  });

  it('shows milliseconds and tenths below a minute with ms precision', () => {
    expect(formatDuration(340, { precision: 'ms' })).toBe('340ms');
    expect(formatDuration(1_240, { precision: 'ms' })).toBe('1.2s');
    expect(formatDuration(3_078, { precision: 'ms' })).toBe('3.1s');
    expect(formatDuration(59_949, { precision: 'ms' })).toBe('59.9s');
    expect(formatDuration(59_999, { precision: 'ms' })).toBe('1m');
    expect(formatDuration(75 * SECOND, { precision: 'ms' })).toBe('1m 15s');
  });

  it('hides seconds with minute precision', () => {
    expect(formatDuration(59 * SECOND, { precision: 'm' })).toBe('<1m');
    expect(formatDuration(3 * MINUTE + 59 * SECOND, { precision: 'm' })).toBe('3m');
    expect(formatDuration(HOUR + MINUTE, { precision: 'm' })).toBe('1h 1m');
  });

  it('treats negative durations as zero', () => {
    expect(formatDuration(-5 * SECOND)).toBe('0s');
  });
});
