import { describe, expect, it } from 'vitest';
import { formatDate } from './date-format';

const NOW = new Date('2026-09-24T18:00:00.000Z').getTime();
const options = { now: NOW, locale: 'en-US' };

describe('formatDate relative-time', () => {
  describe('when the date is in the past', () => {
    it('uses short units', () => {
      expect(formatDate(NOW - 2_000, 'relative-time', options)).toBe('just now');
      expect(formatDate(NOW - 30_000, 'relative-time', options)).toBe('30s ago');
      expect(formatDate(NOW - 5 * 60_000, 'relative-time', options)).toBe('5m ago');
      expect(formatDate(NOW - 3 * 3_600_000, 'relative-time', options)).toBe('3h ago');
      expect(formatDate(NOW - 2 * 86_400_000, 'relative-time', options)).toBe('2d ago');
    });
  });

  describe('when the date is in the future', () => {
    it('uses short units', () => {
      expect(formatDate(NOW + 30_000, 'relative-time', options)).toBe('in 30s');
      expect(formatDate(NOW + 5 * 60_000, 'relative-time', options)).toBe('in 5m');
    });
  });

  describe('when the date is more than 7 days away', () => {
    it('falls back to an absolute date', () => {
      expect(formatDate(new Date('2026-09-01T12:00:00.000Z'), 'relative-time', options)).toBe('Sep 1');
    });
  });

  describe('when the value is unusable', () => {
    it('returns undefined', () => {
      expect(formatDate(undefined, 'relative-time', options)).toBeUndefined();
      expect(formatDate('nope', 'relative-time', options)).toBeUndefined();
    });
  });
});
