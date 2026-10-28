import { describe, expect, it } from 'vitest';

import { toolMoment } from './tool-moment';

const now = new Date(2026, 9, 28, 9, 0, 0);
const at = (month: number, day: number, year = 2026) => new Date(year, month, day, 22, 44, 44);

describe('toolMoment', () => {
  it.each([
    ['earlier today', at(9, 28), 'Today at 10:44:44 PM'],
    ['just before midnight yesterday', at(9, 27), 'Yesterday at 10:44:44 PM'],
    ['earlier this year', at(9, 21), 'Oct 21 at 10:44:44 PM'],
    ['in another year', at(11, 31, 2025), 'Dec 31, 2025 at 10:44:44 PM'],
  ])('names a call made %s by its day and clock', (_, time, expected) => {
    expect(toolMoment(time, { now, locale: 'en-US' }).replace(/\u202f/g, ' ')).toBe(expected);
  });
});
