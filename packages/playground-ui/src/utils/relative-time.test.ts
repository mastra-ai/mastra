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

  describe('relative-long', () => {
    it('describes far dates in words instead of falling back to a date', () => {
      expect(formatDate(NOW + 29 * 86_400_000, 'relative-long', options)).toBe('in 4 weeks');
      expect(formatDate(NOW + 90 * 86_400_000, 'relative-long', options)).toBe('in 3 months');
      expect(formatDate(NOW - 400 * 86_400_000, 'relative-long', options)).toBe('last year');
      expect(formatDate(NOW - 3 * 365 * 86_400_000, 'relative-long', options)).toBe('3 years ago');
    });

    it('uses day, hour, and minute units for near dates', () => {
      expect(formatDate(NOW + 86_400_000, 'relative-long', options)).toBe('tomorrow');
      expect(formatDate(NOW + 3 * 3_600_000, 'relative-long', options)).toBe('in 3 hours');
      expect(formatDate(NOW - 5 * 60_000, 'relative-long', options)).toBe('5 minutes ago');
      expect(formatDate(NOW + 10_000, 'relative-long', options)).toBe('in 10 seconds');
    });

    it('returns undefined for unusable values', () => {
      expect(formatDate(undefined, 'relative-long', options)).toBeUndefined();
    });
  });
});
