import { describe, expect, it } from 'vitest';
import { computeNextFireAt, validateCron } from './cron';

describe('validateCron', () => {
  it('accepts valid 5-part patterns', () => {
    expect(() => validateCron('* * * * *')).not.toThrow();
    expect(() => validateCron('*/5 * * * *')).not.toThrow();
    expect(() => validateCron('0 9 * * 1-5')).not.toThrow();
  });

  it('accepts valid 6-part patterns (with seconds)', () => {
    expect(() => validateCron('*/10 * * * * *')).not.toThrow();
    expect(() => validateCron('0 0 * * * *')).not.toThrow();
  });

  it('accepts a valid IANA timezone', () => {
    expect(() => validateCron('0 9 * * *', 'America/New_York')).not.toThrow();
    expect(() => validateCron('0 9 * * *', 'Europe/London')).not.toThrow();
  });

  it('throws on invalid patterns', () => {
    expect(() => validateCron('not a cron')).toThrow();
    expect(() => validateCron('* * * *')).toThrow();
    expect(() => validateCron('60 * * * *')).toThrow();
  });

  it('throws on invalid timezone', () => {
    expect(() => validateCron('0 9 * * *', 'Not/AZone')).toThrow();
  });
});

describe('computeNextFireAt', () => {
  it('returns the next fire time strictly after the reference', () => {
    // Every minute at second 0
    const ref = new Date('2026-01-01T00:00:30Z').getTime();
    const next = computeNextFireAt('0 * * * * *', { after: ref });
    expect(next).toBe(new Date('2026-01-01T00:01:00Z').getTime());
  });

  it('honors a daily schedule', () => {
    const ref = new Date('2026-01-01T08:00:00Z').getTime();
    const next = computeNextFireAt('0 0 9 * * *', { after: ref, timezone: 'UTC' });
    expect(next).toBe(new Date('2026-01-01T09:00:00Z').getTime());
  });

  it('rolls over to the next day when no slot remains today', () => {
    const ref = new Date('2026-01-01T10:00:00Z').getTime();
    const next = computeNextFireAt('0 0 9 * * *', { after: ref, timezone: 'UTC' });
    expect(next).toBe(new Date('2026-01-02T09:00:00Z').getTime());
  });

  it('respects a non-UTC timezone', () => {
    // 09:00 in America/New_York on 2026-01-02 is 14:00 UTC (EST = UTC-5)
    const ref = new Date('2026-01-02T05:00:00Z').getTime();
    const next = computeNextFireAt('0 0 9 * * *', { after: ref, timezone: 'America/New_York' });
    expect(next).toBe(new Date('2026-01-02T14:00:00Z').getTime());
  });

  it('throws on invalid pattern', () => {
    expect(() => computeNextFireAt('not a cron')).toThrow();
  });
});
