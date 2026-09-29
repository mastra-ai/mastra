import { describe, expect, it } from 'vitest';
import { nextFireTime, parseInterval, validateInterval } from './interval.js';

describe('parseInterval', () => {
  it.each([
    ['5m', 5 * 60_000, '5m'],
    ['2h', 2 * 3_600_000, '2h'],
    ['1d', 86_400_000, '1d'],
    ['30s', 30_000, '30s'],
    ['5 minutes', 5 * 60_000, '5m'],
    ['1 hour', 3_600_000, '1h'],
    ['1 day', 86_400_000, '1d'],
    ['10min', 600_000, '10m'],
    ['3hrs', 3 * 3_600_000, '3h'],
    ['  2H ', 2 * 3_600_000, '2h'],
  ])('parses %s', (input, ms, label) => {
    expect(parseInterval(input)).toEqual({ ms, label });
  });

  it.each(['', 'abc', '5', 'm5', '5 fortnights', '0m', '-5m'])('rejects %s', input => {
    expect(parseInterval(input)).toHaveProperty('error');
  });
});

describe('validateInterval', () => {
  it.each([1, 5, 15, 30, 60, 120, 6 * 60, 12 * 60, 24 * 60])('accepts %d minutes', minutes => {
    expect(validateInterval({ ms: minutes * 60_000 })).toEqual({ ok: true });
  });

  it('rejects sub-minute intervals with a 1m suggestion', () => {
    expect(validateInterval({ ms: 30_000 })).toEqual({
      error: 'Schedules fire at most once per minute.',
      suggestion: '1m',
    });
  });

  it('rejects fractional minutes', () => {
    const result = validateInterval({ ms: 90_000 });
    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('suggestion', '2m');
  });

  it('rejects minutes that do not divide an hour and suggests the nearest divisor', () => {
    expect(validateInterval({ ms: 7 * 60_000 })).toMatchObject({ suggestion: '6m' });
    expect(validateInterval({ ms: 45 * 60_000 })).toMatchObject({ suggestion: '30m' });
    expect(validateInterval({ ms: 25 * 60_000 })).toMatchObject({ suggestion: '20m' });
  });

  it('rejects 90m as not a whole number of hours', () => {
    expect(validateInterval({ ms: 90 * 60_000 })).toMatchObject({ suggestion: '2h' });
  });

  it('rejects hours that do not divide a day', () => {
    expect(validateInterval({ ms: 7 * 3_600_000 })).toMatchObject({ suggestion: '6h' });
    expect(validateInterval({ ms: 5 * 3_600_000 })).toMatchObject({ suggestion: '4h' });
  });

  it('rejects multi-day intervals', () => {
    expect(validateInterval({ ms: 2 * 86_400_000 })).toMatchObject({ suggestion: '1d' });
    expect(validateInterval({ ms: 36 * 3_600_000 })).toMatchObject({ suggestion: '1d' });
  });
});

describe('nextFireTime', () => {
  const at = (h: number, m: number, s = 0, ms = 0) => new Date(2026, 0, 15, h, m, s, ms).getTime();

  it('lands on the next wall-clock boundary', () => {
    expect(nextFireTime(5 * 60_000, at(10, 7, 30))).toBe(at(10, 10));
    expect(nextFireTime(60_000, at(10, 7, 30))).toBe(at(10, 8));
    expect(nextFireTime(2 * 3_600_000, at(11, 59))).toBe(at(12, 0));
  });

  it('is strictly after the given time, even exactly on a boundary', () => {
    expect(nextFireTime(5 * 60_000, at(10, 10))).toBe(at(10, 15));
  });

  it('fires daily schedules at the next local midnight', () => {
    expect(nextFireTime(86_400_000, at(23, 59))).toBe(new Date(2026, 0, 16, 0, 0).getTime());
  });

  it('skips missed boundaries instead of catching up', () => {
    // Woken 17 minutes late: fire at the next boundary after now, not the missed ones.
    expect(nextFireTime(5 * 60_000, at(10, 27, 1))).toBe(at(10, 30));
  });
});
