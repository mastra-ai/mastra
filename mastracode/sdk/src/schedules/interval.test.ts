import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

describe('nextFireTime across daylight-saving changes', () => {
  const originalTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'America/New_York';
  });
  afterAll(() => {
    process.env.TZ = originalTz;
  });
  // Local wall-clock time in New York, rendered as `YYYY-MM-DD HH:MM`.
  const local = (ms: number) => {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const HOUR = 3_600_000;
  // 2026-03-08 02:00 EST jumps to 03:00 EDT; 2026-11-01 02:00 EDT falls back to 01:00 EST.
  const springNoon = new Date('2026-03-08T12:00:00-04:00').getTime();
  const fallNoon = new Date('2026-11-01T12:00:00-05:00').getTime();

  it('keeps daily and multi-hour cadences on the wall clock after the change', () => {
    expect(local(nextFireTime(24 * HOUR, springNoon))).toBe('2026-03-09 00:00');
    expect(local(nextFireTime(2 * HOUR, springNoon))).toBe('2026-03-08 14:00');
    expect(local(nextFireTime(24 * HOUR, fallNoon))).toBe('2026-11-02 00:00');
    expect(local(nextFireTime(2 * HOUR, fallNoon))).toBe('2026-11-01 14:00');
  });

  it('fires a boundary inside the skipped hour at the first minute after the jump', () => {
    const before = new Date('2026-03-08T01:30:00-05:00').getTime();
    expect(local(nextFireTime(HOUR, before))).toBe('2026-03-08 03:00');
    expect(local(nextFireTime(2 * HOUR, before))).toBe('2026-03-08 03:00');
    // …and the next hourly boundary is 04:00, not a second 03:00.
    expect(local(nextFireTime(HOUR, nextFireTime(HOUR, before)))).toBe('2026-03-08 04:00');
  });

  it('does not repeat hourly boundaries in the repeated hour', () => {
    const firstOneAm = new Date('2026-11-01T01:00:00-04:00').getTime();
    const next = nextFireTime(HOUR, firstOneAm);
    expect(next).toBe(new Date('2026-11-01T02:00:00-05:00').getTime());
  });

  it('keeps sub-hour cadences on real minutes through both changes', () => {
    const lastEst = new Date('2026-03-08T01:55:00-05:00').getTime();
    expect(nextFireTime(5 * 60_000, lastEst) - lastEst).toBe(5 * 60_000);
    const lastEdt = new Date('2026-11-01T01:55:00-04:00').getTime();
    const next = nextFireTime(5 * 60_000, lastEdt);
    expect(next - lastEdt).toBe(5 * 60_000);
    expect(local(next)).toBe('2026-11-01 01:00');
  });
});
