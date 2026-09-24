import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './relative-time';

const NOW = new Date('2026-09-24T18:00:00.000Z').getTime();
const options = { now: NOW, locale: 'en-US' };

describe('formatRelativeTime', () => {
  describe('when the date is in the past', () => {
    it('uses short units', () => {
      expect(formatRelativeTime(NOW - 2_000, options)).toBe('just now');
      expect(formatRelativeTime(NOW - 30_000, options)).toBe('30s ago');
      expect(formatRelativeTime(NOW - 5 * 60_000, options)).toBe('5m ago');
      expect(formatRelativeTime(NOW - 3 * 3_600_000, options)).toBe('3h ago');
      expect(formatRelativeTime(NOW - 2 * 86_400_000, options)).toBe('2d ago');
    });
  });

  describe('when the date is in the future', () => {
    it('uses short units', () => {
      expect(formatRelativeTime(NOW + 30_000, options)).toBe('in 30s');
      expect(formatRelativeTime(NOW + 5 * 60_000, options)).toBe('in 5m');
    });
  });

  describe('when the date is more than 7 days away', () => {
    it('falls back to an absolute date', () => {
      expect(formatRelativeTime(new Date('2026-09-01T12:00:00.000Z'), options)).toBe('Sep 1');
    });
  });

  describe('when the value is unusable', () => {
    it('returns undefined', () => {
      expect(formatRelativeTime(undefined, options)).toBeUndefined();
      expect(formatRelativeTime('nope', options)).toBeUndefined();
    });
  });
});
