import { describe, expect, it } from 'vitest';
import { previousWindow, windowLength } from './time-window';

describe('previousWindow', () => {
  describe('when given a 7-day window', () => {
    it('returns the 7 days before it', () => {
      const end = new Date('2026-10-23T00:00:00Z');
      const start = new Date('2026-10-16T00:00:00Z');
      expect(previousWindow({ start, end })).toEqual({ start: new Date('2026-10-09T00:00:00Z'), end: start });
      expect(windowLength({ start, end })).toBe('7 days');
    });
  });

  describe('when given a 24-hour window', () => {
    it('names it in hours', () => {
      expect(windowLength({ start: new Date(0), end: new Date(24 * 3_600_000) })).toBe('24 hours');
    });
  });
});
