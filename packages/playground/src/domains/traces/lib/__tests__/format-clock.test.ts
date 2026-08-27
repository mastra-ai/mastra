import { describe, expect, it } from 'vitest';

import { formatClock } from '../format-clock';

describe('formatClock', () => {
  it('renders the wall clock of the step, so the thread reads as a log', () => {
    const at = new Date(2026, 0, 1, 20, 41, 2);
    expect(formatClock(at)).toBe('20:41:02');
    expect(formatClock(at.toISOString())).toBe('20:41:02');
  });

  it('returns undefined rather than an unusable timestamp', () => {
    expect(formatClock('not a date')).toBeUndefined();
    expect(formatClock(undefined)).toBeUndefined();
  });
});
