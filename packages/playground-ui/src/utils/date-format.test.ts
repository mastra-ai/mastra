import { describe, expect, it } from 'vitest';
import { formatDate, formatShortDate, formatTimestampPrecise, toDate } from './date-format';

const NOW = new Date('2026-09-24T18:00:00.000Z');
const TODAY = new Date('2026-09-24T14:32:00.000Z');
const THIS_YEAR = new Date('2026-03-05T09:07:00.000Z');
const LAST_YEAR = new Date('2025-09-24T14:32:00.000Z');

describe('toDate', () => {
  it('normalises dates, ISO strings and epoch milliseconds', () => {
    expect(toDate(TODAY)?.getTime()).toBe(TODAY.getTime());
    expect(toDate('2026-09-24T14:32:00.000Z')?.getTime()).toBe(TODAY.getTime());
    expect(toDate(TODAY.getTime())?.getTime()).toBe(TODAY.getTime());
  });

  it('returns undefined for missing or invalid values', () => {
    expect(toDate(undefined)).toBeUndefined();
    expect(toDate(null)).toBeUndefined();
    expect(toDate('not-a-date')).toBeUndefined();
  });
});

describe('formatDate', () => {
  describe('when the locale is en-US', () => {
    const locale = 'en-US';

    it('formats the time preset with a 12-hour clock', () => {
      expect(formatDate(TODAY, 'time', { locale })).toBe('2:32 PM');
    });

    it('formats the dateTime preset', () => {
      expect(formatDate(TODAY, 'dateTime', { locale })).toBe('Sep 24, 2026, 2:32 PM');
    });

    it('formats the smart preset relative to today', () => {
      expect(formatDate(TODAY, 'smart', { locale, now: NOW })).toBe('Today 2:32 PM');
      expect(formatDate(THIS_YEAR, 'smart', { locale, now: NOW })).toBe('Mar 5');
      expect(formatDate(LAST_YEAR, 'smart', { locale, now: NOW })).toBe('Sep 24, 2025');
    });

    it('formats short dates without time', () => {
      expect(formatShortDate(THIS_YEAR, { locale, now: NOW })).toBe('Mar 5');
      expect(formatShortDate(LAST_YEAR, { locale, now: NOW })).toBe('Sep 24, 2025');
    });
  });

  describe('when the locale is fr-FR', () => {
    const locale = 'fr-FR';

    it('follows the locale 24-hour clock', () => {
      expect(formatDate(TODAY, 'time', { locale })).toBe('14:32');
      expect(formatDate(TODAY, 'dateTime', { locale })).toContain('14:32');
    });
  });

  describe('when the value is unusable', () => {
    it('returns undefined', () => {
      expect(formatDate(undefined, 'dateTime')).toBeUndefined();
      expect(formatDate('not-a-date', 'smart')).toBeUndefined();
    });
  });
});

describe('formatTimestampPrecise', () => {
  it('keeps milliseconds', () => {
    expect(formatTimestampPrecise(new Date('2026-01-05T14:03:07.250Z'), { locale: 'en-US' })).toBe(
      'Jan 5, 2026, 2:03:07.250 PM',
    );
  });

  it('returns undefined when unusable', () => {
    expect(formatTimestampPrecise(null)).toBeUndefined();
  });
});
