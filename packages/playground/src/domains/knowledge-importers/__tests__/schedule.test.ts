import { describe, expect, it } from 'vitest';
import { describeCron, describeEffectiveSchedule, isFiveFieldCron } from '../schedule';

describe('describeCron', () => {
  describe('when the expression is a common interval', () => {
    it('reads minute steps in plain words', () => {
      expect(describeCron('*/15 * * * *')).toBe('every 15 minutes');
    });

    it('reads the top of every hour', () => {
      expect(describeCron('0 * * * *')).toBe('every hour');
    });

    it('reads hour steps in plain words', () => {
      expect(describeCron('0 */6 * * *')).toBe('every 6 hours');
    });

    it('reads a fixed daily time with zero padding', () => {
      expect(describeCron('5 3 * * *')).toBe('daily at 03:05');
    });
  });

  describe('when the expression restricts days or months', () => {
    it('falls back to the raw expression instead of guessing', () => {
      expect(describeCron('0 9 * * 1-5')).toBe('cron "0 9 * * 1-5"');
    });
  });
});

describe('describeEffectiveSchedule', () => {
  describe('when the server reports no effective schedule', () => {
    it('reads as paused', () => {
      expect(describeEffectiveSchedule(null)).toBe('paused');
    });
  });
});

describe('isFiveFieldCron', () => {
  describe('when the expression has the wrong number of fields', () => {
    it('rejects six-field (seconds) cron', () => {
      expect(isFiveFieldCron('0 */15 * * * *')).toBe(false);
    });
  });

  describe('when the expression contains letters', () => {
    it('rejects it', () => {
      expect(isFiveFieldCron('@hourly')).toBe(false);
    });
  });
});
