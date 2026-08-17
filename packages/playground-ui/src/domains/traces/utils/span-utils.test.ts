import { format } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { formatSpanDuration, formatSpanPanelTimestamp } from './span-utils';

describe('formatSpanDuration', () => {
  describe('when a span has valid start and end times', () => {
    it('formats milliseconds and rounds seconds to one decimal place', () => {
      expect(formatSpanDuration(new Date('2026-01-01T00:00:00.000Z'), new Date('2026-01-01T00:00:00.425Z'))).toBe(
        '425ms',
      );
      expect(formatSpanDuration(new Date('2026-01-01T00:00:00.000Z'), new Date('2026-01-01T00:00:01.250Z'))).toBe(
        '1.3s',
      );
      expect(formatSpanDuration(new Date('2026-01-01T00:00:00.000Z'), new Date('2026-01-01T00:00:46.301Z'))).toBe(
        '46.3s',
      );
    });
  });

  describe('when a span is running or has invalid timing', () => {
    it('leaves the duration empty', () => {
      expect(formatSpanDuration(new Date('2026-01-01T00:00:00.000Z'), undefined)).toBeUndefined();
      expect(formatSpanDuration('not-a-date', new Date('2026-01-01T00:00:00.000Z'))).toBeUndefined();
      expect(
        formatSpanDuration(new Date('2026-01-01T00:00:01.000Z'), new Date('2026-01-01T00:00:00.000Z')),
      ).toBeUndefined();
    });
  });
});

describe('formatSpanPanelTimestamp', () => {
  describe('when a span has a valid timestamp', () => {
    it('formats the day and 12-hour time with milliseconds', () => {
      expect(formatSpanPanelTimestamp(new Date('2026-01-05T14:03:07.250Z'))).toBe(
        format(new Date('2026-01-05T14:03:07.250Z'), 'MMM dd, h:mm:ss.SSS aaa'),
      );
    });
  });

  describe('when a span timestamp is missing or unparseable', () => {
    it('leaves the timestamp empty instead of throwing', () => {
      expect(formatSpanPanelTimestamp(undefined)).toBeUndefined();
      expect(formatSpanPanelTimestamp(null)).toBeUndefined();
      expect(formatSpanPanelTimestamp('not-a-date')).toBeUndefined();
      expect(formatSpanPanelTimestamp(new Date('not-a-date'))).toBeUndefined();
    });
  });
});
