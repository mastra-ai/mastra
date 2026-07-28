import { describe, expect, it } from 'vitest';

import { relativeTime } from '../relativeTime';

// Fixed reference point so every case is deterministic: Jul 6 2026, 12:00 UTC.
const NOW = new Date('2026-07-06T12:00:00.000Z');

const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000).toISOString();
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000).toISOString();
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe('relativeTime', () => {
  it('given an invalid ISO string, then it returns an empty string', () => {
    expect(relativeTime('not-a-date', NOW)).toBe('');
  });

  it('given a timestamp less than a minute ago, then it returns "just now"', () => {
    expect(relativeTime(minutesAgo(0), NOW)).toBe('just now');
    expect(relativeTime(new Date(NOW.getTime() - 30_000).toISOString(), NOW)).toBe('just now');
  });

  it('given a timestamp minutes ago, then it returns compact minutes', () => {
    expect(relativeTime(minutesAgo(1), NOW)).toBe('1m');
    expect(relativeTime(minutesAgo(59), NOW)).toBe('59m');
  });

  it('given a timestamp hours ago, then it returns compact hours', () => {
    expect(relativeTime(hoursAgo(1), NOW)).toBe('1h');
    expect(relativeTime(hoursAgo(23), NOW)).toBe('23h');
  });

  it('given a timestamp days ago within a week, then it returns compact days', () => {
    expect(relativeTime(daysAgo(1), NOW)).toBe('1d');
    expect(relativeTime(daysAgo(6), NOW)).toBe('6d');
  });

  it('given a timestamp a week or more ago, then it returns a short calendar date', () => {
    expect(relativeTime(daysAgo(7), NOW)).toBe('Jun 29');
    expect(relativeTime('2026-01-05T09:00:00.000Z', NOW)).toBe('Jan 5');
  });

  it('given no explicit reference date, then it compares against the current time', () => {
    expect(relativeTime(new Date(Date.now() - 5 * 60_000).toISOString())).toBe('5m');
  });
});
