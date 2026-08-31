import { describe, expect, it } from 'vitest';

import {
  auditRangeShifted,
  auditRangeUnlessFull,
  auditRangeWithBoundary,
  auditRulerStep,
  auditRulerTicks,
} from './auditRuler';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('audit ruler', () => {
  it('picks the finest step that stays under the tick budget', () => {
    expect(auditRulerStep(4 * DAY, 110)).toBe(HOUR);
    expect(auditRulerStep(4 * DAY, 6)).toBe(DAY);
    expect(auditRulerStep(2 * HOUR, 110)).toBe(5 * 60_000);
    expect(auditRulerStep(400 * DAY, 6)).toBe(7 * DAY);
  });

  it('lands ticks on local boundaries inside the bounds', () => {
    const bounds = { from: new Date(2026, 7, 21, 8, 40).getTime(), to: new Date(2026, 7, 24, 3, 10).getTime() };
    const ticks = auditRulerTicks(bounds, DAY);

    expect(ticks.map(at => new Date(at).getHours())).toEqual([0, 0, 0]);
    expect(new Date(ticks[0]!).getDate()).toBe(22);
    expect(ticks.at(-1)).toBeLessThanOrEqual(bounds.to);
  });

  it('refines to the minute and never crosses the opposite boundary', () => {
    const bounds = { from: 0, to: 100 * DAY };
    const range = { from: 20 * DAY, to: 60 * DAY };
    const minute = 60_000;

    expect(auditRangeWithBoundary(range, 'from', 20 * DAY + 90_000, bounds).from).toBe(20 * DAY + 90_000);
    expect(auditRangeWithBoundary(range, 'from', 90 * DAY, bounds).from).toBe(60 * DAY - minute);
    expect(auditRangeWithBoundary(range, 'to', 0, bounds).to).toBe(20 * DAY + minute);
    expect(auditRangeWithBoundary(range, 'from', -DAY, bounds).from).toBe(0);
    expect(auditRangeWithBoundary(range, 'to', 200 * DAY, bounds).to).toBe(100 * DAY);
  });

  it('keeps the span while panning and stops at the bounds', () => {
    const bounds = { from: 0, to: 100 * DAY };
    const range = { from: 20 * DAY, to: 60 * DAY };

    expect(auditRangeShifted(range, 5 * DAY, bounds)).toEqual({ from: 25 * DAY, to: 65 * DAY });
    expect(auditRangeShifted(range, 90 * DAY, bounds)).toEqual({ from: 60 * DAY, to: 100 * DAY });
    expect(auditRangeShifted(range, -90 * DAY, bounds)).toEqual({ from: 0, to: 40 * DAY });
  });

  it('reports a full-width selection as no filter at all', () => {
    const bounds = { from: 0, to: 100 };

    expect(auditRangeUnlessFull({ from: 0, to: 100 }, bounds)).toBeUndefined();
    expect(auditRangeUnlessFull({ from: 10, to: 100 }, bounds)).toEqual({ from: 10, to: 100 });
  });
});
