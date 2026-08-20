import { describe, expect, it } from 'vitest';

import { actionLabel, sliceBetween } from './audit-log';

const HOUR = 3_600_000;
const BOUNDS = { from: 0, to: 24 * HOUR };

describe('actionLabel', () => {
  it('names the namespace when the verb alone is ambiguous', () => {
    expect(actionLabel('factory.git.commit')).toBe('Git commit');
    expect(actionLabel('factory.agent.commit')).toBe('Agent commit');
  });

  it('leaves work item verbs bare — the card column already names the subject', () => {
    expect(actionLabel('factory.work_item.stage_moved')).toBe('Stage moved');
  });
});

describe('sliceBetween', () => {
  it('picks the span a drag covers, whichever way it was dragged', () => {
    expect(sliceBetween(9 * HOUR, 3 * HOUR, BOUNDS)).toEqual({ from: 3 * HOUR, to: 9 * HOUR });
  });

  it('opens a readable slice around a tap instead of an empty instant', () => {
    expect(sliceBetween(5 * HOUR, 5 * HOUR, BOUNDS)).toEqual({ from: 4 * HOUR, to: 6 * HOUR });
  });

  it('never picks time the window does not hold', () => {
    expect(sliceBetween(0, 0, BOUNDS)).toEqual({ from: 0, to: HOUR });
    expect(sliceBetween(24 * HOUR, 24 * HOUR, BOUNDS)).toEqual({ from: 23 * HOUR, to: 24 * HOUR });
  });
});
