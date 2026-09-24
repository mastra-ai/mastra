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
  describe('when timestamps require second precision', () => {
    it('keeps the time of a historical score', () => {
      expect(
        formatDate('2026-09-23T10:14:12Z', 'dateTimeSeconds', { locale: 'en-US', timeZone: 'UTC', now: NOW }),
      ).toBe('Sep 23, 2026, 10:14:12 AM');
    });

    it('distinguishes timeline events within one minute', () => {
      const options = { locale: 'en-GB', timeZone: 'UTC' };
      expect(formatDate('2026-09-24T10:00:00Z', 'dateTimeCompact', options)).toBe('24/09, 10:00:00');
      expect(formatDate('2026-09-24T10:00:15Z', 'dateTimeCompact', options)).toBe('24/09, 10:00:15');
    });
  });

  describe('when the requested time zone crosses a calendar boundary', () => {
    it('does not label yesterday as today', () => {
      expect(
        formatDate('2026-09-24T06:30:00Z', 'smart', {
          locale: 'en-US',
          timeZone: 'America/Los_Angeles',
          now: new Date('2026-09-24T07:30:00Z'),
        }),
      ).toBe('Sep 23');
    });

    it('labels the same local day as today across UTC midnight', () => {
      expect(
        formatDate('2026-09-24T23:30:00Z', 'smart', {
          locale: 'en-US',
          timeZone: 'America/Los_Angeles',
          now: new Date('2026-09-25T00:30:00Z'),
        }),
      ).toBe('Today 4:30 PM');
    });

    it('includes the year when local years differ', () => {
      expect(
        formatShortDate('2026-01-01T07:30:00Z', {
          locale: 'en-US',
          timeZone: 'America/Los_Angeles',
          now: new Date('2026-01-01T08:30:00Z'),
        }),
      ).toBe('Dec 31, 2025');
    });

    it('omits the year when local years match across UTC New Year', () => {
      expect(
        formatShortDate('2025-12-31T23:30:00Z', {
          locale: 'en-US',
          timeZone: 'America/Los_Angeles',
          now: new Date('2026-01-01T00:30:00Z'),
        }),
      ).toBe('Dec 31');
    });
  });
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
