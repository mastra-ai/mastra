import { describe, expect, it } from 'vitest';
import { computeInitialFire, computeNextFire, computeNextFireAt, validateCron, validateScheduleTiming } from './cron';

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

  it('labels timezone failures as timezone errors, not cron errors', () => {
    expect(() => validateCron('0 9 * * *', 'Not/AZone')).toThrow('Invalid timezone "Not/AZone"');
  });

  it('throws a clear error when cron is missing', () => {
    // @ts-expect-error - exercising the runtime guard for callers passing undefined
    expect(() => validateCron(undefined)).toThrow('expected a non-empty cron string');
    expect(() => validateCron('')).toThrow('expected a non-empty cron string');
    expect(() => validateCron('   ')).toThrow('expected a non-empty cron string');
  });

  it('wraps croner errors with the offending pattern', () => {
    expect(() => validateCron('not a cron')).toThrow('Invalid cron expression "not a cron"');
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

describe('validateScheduleTiming', () => {
  it('requires exactly one of cron or runAt', () => {
    expect(() => validateScheduleTiming({})).toThrow(/exactly one/);
    expect(() => validateScheduleTiming({ cron: '* * * * *', runAt: Date.now() + 1000 })).toThrow(/exactly one/);
    expect(() => validateScheduleTiming({ runAt: new Date(Date.now() + 1000) })).not.toThrow();
  });

  it('only allows a future endAt together with cron', () => {
    expect(() => validateScheduleTiming({ runAt: Date.now() + 1000, endAt: Date.now() + 2000 })).toThrow(
      /only allowed/,
    );
    expect(() => validateScheduleTiming({ cron: '* * * * *', endAt: Date.now() - 1000 })).toThrow(/future/);
    expect(() => validateScheduleTiming({ cron: '* * * * *', endAt: Date.now() + 60_000 })).not.toThrow();
  });

  it('rejects invalid dates', () => {
    expect(() => validateScheduleTiming({ runAt: new Date('nope') })).toThrow(/runAt/);
  });
});

describe('computeInitialFire / computeNextFire', () => {
  it('fires a one-off at runAt and completes it on claim', () => {
    const runAt = Date.now() + 10_000;
    expect(computeInitialFire({ runAt })).toEqual({ nextFireAt: runAt, completed: false });
    expect(computeNextFire({ cron: '', runAt, nextFireAt: runAt }, runAt)).toEqual({
      nextFireAt: runAt,
      completed: true,
    });
  });

  it('completes a bounded cron once the next occurrence passes endAt', () => {
    const now = Date.UTC(2030, 0, 1, 0, 0, 0);
    const endAt = now + 90_000;
    const first = computeNextFire({ cron: '* * * * *', endAt, nextFireAt: now }, now);
    expect(first.completed).toBe(false);
    const second = computeNextFire({ cron: '* * * * *', endAt, nextFireAt: first.nextFireAt }, first.nextFireAt);
    expect(second.completed).toBe(true);
  });

  it('never completes an unbounded cron', () => {
    expect(computeNextFire({ cron: '* * * * *', nextFireAt: 0 }, Date.now()).completed).toBe(false);
  });
});
