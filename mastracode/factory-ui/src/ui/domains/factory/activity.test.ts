import { describe, expect, it, vi } from 'vitest';

import { dayHeading, groupByDay, startOfLocalDay } from './activity';

const NOW = new Date(2026, 6, 17, 12).getTime();

describe('groupByDay', () => {
  it('cuts the stream where the local day changes', () => {
    const events = [1, 3, 40].map(hours => ({ at: NOW - hours * 3_600_000 }));

    expect(groupByDay(events).map(day => day.items.length)).toEqual([2, 1]);
  });
});

describe('dayHeading', () => {
  it('names today and yesterday, and dates everything older', () => {
    const today = new Date(NOW);
    today.setHours(0, 0, 0, 0);

    expect(dayHeading(today.getTime(), NOW)).toBe('Today');
    expect(dayHeading(today.getTime() - 86_400_000, NOW)).toBe('Yesterday');
    expect(dayHeading(today.getTime() - 5 * 86_400_000, NOW)).not.toBe('Yesterday');
  });

  it('still names yesterday when the clocks went back overnight', () => {
    vi.stubEnv('TZ', 'America/New_York');
    try {
      const now = new Date(2026, 10, 2, 12).getTime();
      const yesterday = startOfLocalDay(new Date(2026, 10, 1, 12).getTime());

      expect(dayHeading(yesterday, now)).toBe('Yesterday');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
