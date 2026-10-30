import { describe, expect, it } from 'vitest';
import {
  describeCron,
  describeEffectiveSchedule,
  describeSchedule,
  isFiveFieldCron,
  nextRunTimes,
  parseCron,
  scheduleChoice,
} from '../schedule';

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

  describe('when the expression restricts the day of week', () => {
    it('reads Monday to Friday as weekdays', () => {
      expect(describeCron('30 8 * * 1-5')).toBe('weekdays at 08:30');
    });

    it('names listed days', () => {
      expect(describeCron('0 9 * * 1,3')).toBe('every Monday, Wednesday at 09:00');
    });
  });

  describe('when the expression restricts days of month or months', () => {
    it('falls back to the raw expression instead of guessing', () => {
      expect(describeCron('0 9 1 * *')).toBe('cron "0 9 1 * *"');
    });
  });
});

describe('describeSchedule', () => {
  describe('when the cron has no plain-words reading', () => {
    it('says it runs on a custom schedule rather than echoing cron', () => {
      expect(describeSchedule('0 9 1 * *')).toBe('On a custom schedule');
    });
  });

  describe('when the cron is a common interval', () => {
    it('reads as a capitalised sentence', () => {
      expect(describeSchedule('*/15 * * * *')).toBe('Every 15 minutes');
    });
  });
});

describe('parseCron', () => {
  describe('when a field is out of range', () => {
    it('names the field and the allowed range', () => {
      const result = parseCron('0 25 * * *');
      expect(result.ok ? undefined : result.error).toMatch(/Hour must be 0–23/);
    });
  });

  describe('when the expression has the wrong number of fields', () => {
    it('explains the five fields', () => {
      const result = parseCron('*/15 * * *');
      expect(result.ok ? undefined : result.error).toMatch(/Use five fields/);
    });
  });

  describe('when the expression uses steps, ranges and lists', () => {
    it('accepts it', () => {
      expect(parseCron('*/10 8-18 * * 1,2,3').ok).toBe(true);
    });
  });
});

describe('nextRunTimes', () => {
  describe('when the cron runs on weekday mornings', () => {
    it('skips the weekend', () => {
      const saturdayNoon = new Date(2026, 9, 31, 12, 0);
      const parsed = parseCron('30 8 * * 1-5');
      const runs = parsed.ok ? nextRunTimes(parsed.cron, saturdayNoon, 2) : [];
      expect(runs.map(run => [run.getDay(), run.getHours(), run.getMinutes()])).toEqual([
        [1, 8, 30],
        [2, 8, 30],
      ]);
    });
  });
});

describe('scheduleChoice', () => {
  describe('when imports are disabled', () => {
    it('is off whatever the cron says', () => {
      expect(scheduleChoice(false, '*/15 * * * *', false)).toBe('off');
    });
  });

  describe('when the cron matches a preset', () => {
    it('picks the preset', () => {
      expect(scheduleChoice(true, '0 * * * *', false)).toBe('hourly');
    });
  });

  describe('when the user pinned Custom', () => {
    it('stays custom even for a preset cron', () => {
      expect(scheduleChoice(true, '0 * * * *', true)).toBe('custom');
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
