import { describe, it, expect } from 'vitest';

import {
  formatRelativeTime,
  formatGapBetweenDates,
  parseDateFromContent,
  isFutureIntentObservation,
  expandInlineEstimatedDates,
  addRelativeTimeToObservations,
} from '../date-utils';

/** Helper: create a Date offset by `days` from `base`. */
function daysFrom(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

describe('formatRelativeTime', () => {
  const now = new Date('2025-06-15T12:00:00Z');

  it('returns "today" for the same day', () => {
    expect(formatRelativeTime(now, now)).toBe('today');
  });

  it('returns "yesterday" for 1 day ago', () => {
    expect(formatRelativeTime(daysFrom(now, -1), now)).toBe('yesterday');
  });

  it('returns "N days ago" for 2-6 days', () => {
    expect(formatRelativeTime(daysFrom(now, -3), now)).toBe('3 days ago');
    expect(formatRelativeTime(daysFrom(now, -6), now)).toBe('6 days ago');
  });

  it('returns "1 week ago" for 7-13 days', () => {
    expect(formatRelativeTime(daysFrom(now, -7), now)).toBe('1 week ago');
    expect(formatRelativeTime(daysFrom(now, -13), now)).toBe('1 week ago');
  });

  it('returns "N weeks ago" for 14-29 days', () => {
    expect(formatRelativeTime(daysFrom(now, -14), now)).toBe('2 weeks ago');
    expect(formatRelativeTime(daysFrom(now, -21), now)).toBe('3 weeks ago');
  });

  it('returns "1 month ago" for 30-59 days', () => {
    expect(formatRelativeTime(daysFrom(now, -30), now)).toBe('1 month ago');
    expect(formatRelativeTime(daysFrom(now, -59), now)).toBe('1 month ago');
  });

  it('returns "N months ago" for 60-364 days', () => {
    expect(formatRelativeTime(daysFrom(now, -90), now)).toBe('3 months ago');
    expect(formatRelativeTime(daysFrom(now, -180), now)).toBe('6 months ago');
  });

  it('returns "1 year ago" for exactly 365 days', () => {
    expect(formatRelativeTime(daysFrom(now, -365), now)).toBe('1 year ago');
  });

  it('returns "N years ago" with plural for multiple years', () => {
    expect(formatRelativeTime(daysFrom(now, -730), now)).toBe('2 years ago');
    expect(formatRelativeTime(daysFrom(now, -1095), now)).toBe('3 years ago');
  });
});

describe('formatGapBetweenDates', () => {
  const base = new Date('2025-06-01T12:00:00Z');

  it('returns null for same day', () => {
    expect(formatGapBetweenDates(base, base)).toBeNull();
  });

  it('returns null for consecutive days (1 day gap)', () => {
    expect(formatGapBetweenDates(base, daysFrom(base, 1))).toBeNull();
  });

  it('returns "[N days later]" for 2-6 day gaps', () => {
    expect(formatGapBetweenDates(base, daysFrom(base, 3))).toBe('[3 days later]');
    expect(formatGapBetweenDates(base, daysFrom(base, 6))).toBe('[6 days later]');
  });

  it('returns "[1 week later]" for 7-13 day gaps', () => {
    expect(formatGapBetweenDates(base, daysFrom(base, 7))).toBe('[1 week later]');
    expect(formatGapBetweenDates(base, daysFrom(base, 13))).toBe('[1 week later]');
  });

  it('returns "[N weeks later]" for 14-29 day gaps', () => {
    expect(formatGapBetweenDates(base, daysFrom(base, 14))).toBe('[2 weeks later]');
    expect(formatGapBetweenDates(base, daysFrom(base, 25))).toBe('[3 weeks later]');
  });

  it('returns "[1 month later]" for 30-59 day gaps', () => {
    expect(formatGapBetweenDates(base, daysFrom(base, 30))).toBe('[1 month later]');
    expect(formatGapBetweenDates(base, daysFrom(base, 59))).toBe('[1 month later]');
  });

  it('returns "[N months later]" for 60+ day gaps', () => {
    expect(formatGapBetweenDates(base, daysFrom(base, 90))).toBe('[3 months later]');
    expect(formatGapBetweenDates(base, daysFrom(base, 180))).toBe('[6 months later]');
  });
});

describe('parseDateFromContent', () => {
  it('parses simple date "May 30, 2023"', () => {
    const result = parseDateFromContent('May 30, 2023');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2023);
    expect(result!.getMonth()).toBe(4); // May = 4
    expect(result!.getDate()).toBe(30);
  });

  it('parses date without comma "May 30 2023"', () => {
    const result = parseDateFromContent('May 30 2023');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2023);
  });

  it('parses range format "May 27-28, 2023" using first date', () => {
    const result = parseDateFromContent('May 27-28, 2023');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getDate()).toBe(27);
  });

  it('parses "early May 2023" as day 7', () => {
    const result = parseDateFromContent('early May 2023');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getDate()).toBe(7);
    expect(result!.getMonth()).toBe(4);
  });

  it('parses "late April 2023" as day 23', () => {
    const result = parseDateFromContent('late April 2023');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getDate()).toBe(23);
    expect(result!.getMonth()).toBe(3); // April = 3
  });

  it('parses "mid May 2023" as day 15', () => {
    const result = parseDateFromContent('mid May 2023');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getDate()).toBe(15);
  });

  it('parses "mid-to-late May 2023" using first modifier', () => {
    const result = parseDateFromContent('mid-to-late May 2023');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getMonth()).toBe(4);
  });

  it('parses cross-month range "April to May 2023"', () => {
    const result = parseDateFromContent('April to May 2023');
    expect(result).toBeInstanceOf(Date);
    // Uses second month (May) day 1
    expect(result!.getMonth()).toBe(4);
    expect(result!.getDate()).toBe(1);
  });

  it('returns null for unparseable content', () => {
    expect(parseDateFromContent('sometime soon')).toBeNull();
    expect(parseDateFromContent('next week')).toBeNull();
    expect(parseDateFromContent('')).toBeNull();
  });
});

describe('isFutureIntentObservation', () => {
  it('detects "will" patterns', () => {
    expect(isFutureIntentObservation('User will attend the meeting')).toBe(true);
    expect(isFutureIntentObservation('She will be traveling next week')).toBe(true);
  });

  it('detects "plans to" and "plan to"', () => {
    expect(isFutureIntentObservation('User plans to visit Paris')).toBe(true);
    expect(isFutureIntentObservation('They plan to refactor the code')).toBe(true);
  });

  it('detects "planning to"', () => {
    expect(isFutureIntentObservation('User is planning to move')).toBe(true);
  });

  it('detects "looking forward to"', () => {
    expect(isFutureIntentObservation('Looking forward to the concert')).toBe(true);
  });

  it('detects "going to"', () => {
    expect(isFutureIntentObservation('User is going to start a new project')).toBe(true);
  });

  it('detects "intends to" and "intend to"', () => {
    expect(isFutureIntentObservation('User intends to apply')).toBe(true);
    expect(isFutureIntentObservation('They intend to finish by Friday')).toBe(true);
  });

  it('detects "wants to" and "want to"', () => {
    expect(isFutureIntentObservation('User wants to learn Rust')).toBe(true);
  });

  it('detects "needs to" and "need to"', () => {
    expect(isFutureIntentObservation('User needs to file taxes')).toBe(true);
  });

  it('detects "about to"', () => {
    expect(isFutureIntentObservation('User is about to leave')).toBe(true);
  });

  it('returns false for non-future-intent lines', () => {
    expect(isFutureIntentObservation('User completed the project')).toBe(false);
    expect(isFutureIntentObservation('Discussed options for lunch')).toBe(false);
    expect(isFutureIntentObservation('User prefers dark mode')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isFutureIntentObservation('USER WILL ATTEND')).toBe(true);
    expect(isFutureIntentObservation('Plans To Visit')).toBe(true);
  });
});

describe('expandInlineEstimatedDates', () => {
  const now = new Date('2025-06-15T12:00:00Z');

  it('expands "(estimated May 30, 2023)" with relative time', () => {
    const input = 'User bought tickets (estimated May 30, 2023)';
    const result = expandInlineEstimatedDates(input, now);
    expect(result).toContain('estimated May 30, 2023 -');
    expect(result).toContain('ago)');
  });

  it('expands "(meaning May 30, 2023)" with relative time', () => {
    const input = 'Started the job (meaning May 30, 2023)';
    const result = expandInlineEstimatedDates(input, now);
    expect(result).toContain('meaning May 30, 2023 -');
  });

  it('adds "likely already happened" for past future-intent observations', () => {
    const input = 'User will attend the conference (estimated May 30, 2023)';
    const result = expandInlineEstimatedDates(input, now);
    expect(result).toContain('likely already happened');
  });

  it('does not add "likely already happened" for non-future-intent lines', () => {
    const input = 'User bought tickets (estimated May 30, 2023)';
    const result = expandInlineEstimatedDates(input, now);
    expect(result).not.toContain('likely already happened');
  });

  it('leaves unparseable inline dates unchanged', () => {
    const input = 'User mentioned (estimated sometime soon)';
    // "sometime soon" has no year, so the outer regex won't match
    expect(expandInlineEstimatedDates(input, now)).toBe(input);
  });

  it('handles multiple inline dates in one string', () => {
    const input = ['Bought item A (estimated May 10, 2023)', 'Bought item B (estimated June 1, 2023)'].join('\n');
    const result = expandInlineEstimatedDates(input, now);
    // Both should be expanded
    expect(result).toContain('May 10, 2023 -');
    expect(result).toContain('June 1, 2023 -');
  });
});

describe('addRelativeTimeToObservations', () => {
  const now = new Date('2025-06-15T12:00:00Z');

  it('annotates "Date:" headers with relative time', () => {
    const input = 'Date: June 10, 2025\n- User said hello';
    const result = addRelativeTimeToObservations(input, now);
    expect(result).toContain('Date: June 10, 2025 (5 days ago)');
  });

  it('handles multiple date headers', () => {
    const input = ['Date: June 1, 2025', '- First observation', 'Date: June 10, 2025', '- Second observation'].join(
      '\n',
    );
    const result = addRelativeTimeToObservations(input, now);
    expect(result).toContain('June 1, 2025 (2 weeks ago)');
    expect(result).toContain('June 10, 2025 (5 days ago)');
  });

  it('inserts gap markers between dates with significant gaps', () => {
    const input = ['Date: May 1, 2025', '- Early observation', 'Date: June 10, 2025', '- Later observation'].join('\n');
    const result = addRelativeTimeToObservations(input, now);
    // 40-day gap → should produce a gap marker
    expect(result).toMatch(/\[.*later\]/);
  });

  it('does not insert gap markers for consecutive dates', () => {
    const input = ['Date: June 14, 2025', '- Yesterday obs', 'Date: June 15, 2025', '- Today obs'].join('\n');
    const result = addRelativeTimeToObservations(input, now);
    expect(result).not.toMatch(/\[.*later\]/);
  });

  it('returns observations unchanged when no date headers are present', () => {
    const input = '- User prefers dark mode\n- User uses TypeScript';
    const result = addRelativeTimeToObservations(input, now);
    expect(result).toBe(input);
  });

  it('also expands inline estimated dates', () => {
    const input = ['Date: June 10, 2025', '- User bought tickets (estimated May 30, 2025)'].join('\n');
    const result = addRelativeTimeToObservations(input, now);
    // Date header should be annotated
    expect(result).toContain('June 10, 2025 (5 days ago)');
    // Inline date should be expanded
    expect(result).toContain('May 30, 2025 -');
  });

  it('handles "today" for current date', () => {
    const input = 'Date: June 15, 2025\n- Something happened';
    const result = addRelativeTimeToObservations(input, now);
    expect(result).toContain('Date: June 15, 2025 (today)');
  });
});
