import { describe, it, expect } from 'vitest';

import {
  formatGapBetweenDates,
  parseDateFromContent,
  parseDateSpan,
  formatRelativeSpan,
  annotateObservationTextDates,
  isFutureIntentObservation,
  expandInlineEstimatedDates,
  addRelativeTimeToObservations,
} from '../date-utils';

/** Helper: create a Date offset by `days` from `base`. */
function daysFrom(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

describe('formatRelativeSpan', () => {
  const now = new Date('2025-06-15T12:00:00Z');
  /** A single-day span on the calendar date `days` away from `now`'s, in the process time zone. */
  const daysAway = (days: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    return formatRelativeSpan({ start: date, end: date }, now);
  };

  it('returns "today" for the same day', () => {
    expect(daysAway(0)).toBe('today');
  });

  it('returns "yesterday" for 1 day ago', () => {
    expect(daysAway(-1)).toBe('yesterday');
  });

  it('returns "N days ago" for 2-6 days', () => {
    expect(daysAway(-3)).toBe('3 days ago');
    expect(daysAway(-6)).toBe('6 days ago');
  });

  it('returns "1 week ago" for 7-13 days', () => {
    expect(daysAway(-7)).toBe('1 week ago');
    expect(daysAway(-13)).toBe('1 week ago');
  });

  it('returns "N weeks ago" for 14-29 days', () => {
    expect(daysAway(-14)).toBe('2 weeks ago');
    expect(daysAway(-21)).toBe('3 weeks ago');
  });

  it('returns "1 month ago" for 30-59 days', () => {
    expect(daysAway(-30)).toBe('1 month ago');
    expect(daysAway(-59)).toBe('1 month ago');
  });

  it('returns "N months ago" for 60-364 days', () => {
    expect(daysAway(-90)).toBe('3 months ago');
    expect(daysAway(-180)).toBe('6 months ago');
  });

  it('returns "1 year ago" for exactly 365 days', () => {
    expect(daysAway(-365)).toBe('1 year ago');
  });

  it('returns \"N years ago\" with plural for multiple years', () => {
    expect(daysAway(-730)).toBe('2 years ago');
    expect(daysAway(-1095)).toBe('3 years ago');
  });

  it('returns \"tomorrow\" for 1 day in the future', () => {
    expect(daysAway(1)).toBe('tomorrow');
  });

  it('returns \"in N days\" for 2-6 days in the future', () => {
    expect(daysAway(3)).toBe('in 3 days');
    expect(daysAway(6)).toBe('in 6 days');
  });

  it('returns \"in 1 week\" for 7-13 days in the future', () => {
    expect(daysAway(7)).toBe('in 1 week');
    expect(daysAway(13)).toBe('in 1 week');
  });

  it('returns \"in N weeks\" for 14-29 days in the future', () => {
    expect(daysAway(14)).toBe('in 2 weeks');
    expect(daysAway(21)).toBe('in 3 weeks');
  });

  it('returns \"in 1 month\" for 30-59 days in the future', () => {
    expect(daysAway(30)).toBe('in 1 month');
  });

  it('returns \"in N months\" for 60-364 days in the future', () => {
    expect(daysAway(90)).toBe('in 3 months');
  });

  it('returns \"in N years\" for 365+ days in the future', () => {
    expect(daysAway(365)).toBe('in 1 year');
    expect(daysAway(730)).toBe('in 2 years');
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

  it('parses cross-month range "April to May 2023" as the start of the range', () => {
    const result = parseDateFromContent('April to May 2023');
    expect(result).toBeInstanceOf(Date);
    expect(result!.getMonth()).toBe(3);
    expect(result!.getDate()).toBe(1);
  });

  it('returns null for unparseable content', () => {
    expect(parseDateFromContent('sometime soon')).toBeNull();
    expect(parseDateFromContent('next week')).toBeNull();
    expect(parseDateFromContent('')).toBeNull();
  });
});

describe('parseDateSpan', () => {
  const day = (d: Date | undefined) =>
    d
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : null;
  const span = (text: string) => {
    const result = parseDateSpan(text);
    return result ? [day(result.start), day(result.end)] : null;
  };

  it.each([
    ['May 30, 2023', '2023-05-30', '2023-05-30'],
    ['Mar 22, 2025 at 18:08', '2025-03-22', '2025-03-22'],
    ['February 26, 2023 at 3:00 PM', '2023-02-26', '2023-02-26'],
    ['May 27-28, 2023', '2023-05-27', '2023-05-28'],
    ['August 13–27, 2024', '2024-08-13', '2024-08-27'],
    ['approx. Dec 27–31, 2021', '2021-12-27', '2021-12-31'],
    ['Mar 1 - Mar 18, 2025', '2025-03-01', '2025-03-18'],
    ['Aug 1, 2024 - Feb 28, 2025', '2024-08-01', '2025-02-28'],
    ['Jul - Dec 2024', '2024-07-01', '2024-12-31'],
    ['August 2024', '2024-08-01', '2024-08-31'],
    ['June–July 2022', '2022-06-01', '2022-07-31'],
    ['approx. Dec 2021 – June 2023', '2021-12-01', '2023-06-30'],
    ['late 2023', '2023-11-15', '2023-11-15'],
    ['2035', '2035-01-01', '2035-12-31'],
    ['approx. 2021–2026', '2021-01-01', '2026-12-31'],
    ['approx. 2022–2023 or 2023–2024', '2022-01-01', '2024-12-31'],
    ['mid-to-late May 2023', '2023-05-15', '2023-05-23'],
    ['2024-01-10', '2024-01-10', '2024-01-10'],
    ['Dec 27 – Jan 3, 2025', '2024-12-27', '2025-01-03'],
    ['Dec – Jan 2025', '2024-12-01', '2025-01-31'],
    ['Dec 27, 2024 – Jan 3', '2024-12-27', '2025-01-03'],
  ])('parses "%s" as %s to %s', (text, start, end) => {
    expect(span(text)).toEqual([start, end]);
  });

  it.each([
    'Oct 19',
    'Nov 2 20:36',
    'Jan 22 - Jan 31',
    'late May',
    'Feb 30, 2023',
    'Mar 5 - Mar 1, 2025',
    'next week',
    '',
  ])('returns null for "%s", which has no known year or is not a real date', text => {
    expect(parseDateSpan(text)).toBeNull();
  });
});

describe('formatRelativeSpan', () => {
  const now = new Date(2025, 2, 26, 12);

  it('collapses a span whose ends read the same', () => {
    expect(formatRelativeSpan({ start: new Date(2020, 3, 1), end: new Date(2020, 3, 30) }, now)).toBe('4 years ago');
  });

  it('joins past ends with "to"', () => {
    expect(formatRelativeSpan({ start: new Date(2024, 7, 1), end: new Date(2025, 1, 28) }, now)).toBe(
      '7 months ago to 3 weeks ago',
    );
  });

  it('reads a span running into the future as "from now"', () => {
    expect(formatRelativeSpan({ start: new Date(2021, 0, 1), end: new Date(2026, 11, 31) }, now)).toBe(
      '4 years ago to 1 year from now',
    );
  });

  it('does not repeat "in" for a wholly future span', () => {
    expect(formatRelativeSpan({ start: new Date(2025, 5, 1), end: new Date(2025, 6, 31) }, now)).toBe(
      'in 2 months to 4 months',
    );
  });
});

describe('annotateObservationTextDates', () => {
  const now = new Date(2025, 2, 26, 12);

  it('annotates a dated event in observation text', () => {
    expect(annotateObservationTextDates('* User had an exam on January 10, 2024 at 3:00 PM.', now)).toBe(
      '* User had an exam on January 10, 2024 at 3:00 PM (1 year ago).',
    );
  });

  it('annotates month-year dates and ranges that state their year', () => {
    expect(annotateObservationTextDates('EduCon Apr 2020; Phase 1 (Mar 1–15, 2025)', now)).toBe(
      'EduCon Apr 2020 (4 years ago); Phase 1 (Mar 1–15, 2025 - 3 weeks ago to 1 week ago)',
    );
  });

  it('annotates a range that crosses New Year with one stated year', () => {
    expect(annotateObservationTextDates('* Trip Dec 27 – Jan 3, 2025.', now)).toBe(
      '* Trip Dec 27 – Jan 3, 2025 (2 months ago).',
    );
  });

  it('skips dates without a year', () => {
    const input = '* Daughter Brittany (5; bday Oct 19). Timeline: Feb 24 50%, Feb 27 75% (Nov 2 20:36).';
    expect(annotateObservationTextDates(input, now)).toBe(input);
  });

  it('skips bare years, which are too ambiguous in free text', () => {
    const input = '* Target of 2035 users by 2030.';
    expect(annotateObservationTextDates(input, now)).toBe(input);
  });

  it('leaves ISO dates inside identifiers, versions and paths unchanged', () => {
    const input = [
      '* Switched to `gpt-4o-2024-08-06` with api-version=2024-02-15-preview.',
      '* Added migrations/2024-01-10-add-users.sql on release/2025-09-01; see https://example.com/blog/2024-05-01-launch.',
      '* Ran `date -d 2024-01-10`.',
    ].join('\n');
    expect(annotateObservationTextDates(input, now)).toBe(input);
  });

  it('leaves Date: headers and meaning/estimated notes to their own passes', () => {
    const input = 'Date: Mar 20, 2025\n* Launch (meaning Mar 22, 2025) and (estimated June 2025).';
    expect(annotateObservationTextDates(input, now)).toBe(input);
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

  it('correctly handles duplicate inline date snippets with different line contexts', () => {
    // Both lines have the exact same date, but only the second is future-intent
    const input = [
      'Bought tickets for event (estimated May 30, 2023)',
      'User plans to attend event (estimated May 30, 2023)',
    ].join('\n');
    const result = expandInlineEstimatedDates(input, now);
    const lines = result.split('\n');
    // First line: not future-intent, should NOT have "likely already happened"
    expect(lines[0]).not.toContain('likely already happened');
    // Second line: future-intent ("plans to"), should have "likely already happened"
    expect(lines[1]).toContain('likely already happened');
  });

  it.each([
    ['(meaning Mar 22, 2025 at 18:08)', '(meaning Mar 22, 2025 at 18:08 - 2 months ago)'],
    ['(meaning August 13–27, 2024)', '(meaning August 13–27, 2024 - 10 months ago to 9 months ago)'],
    ['(meaning approx. late 2023)', '(meaning approx. late 2023 - 1 year ago)'],
    ['(meaning August 2024)', '(meaning August 2024 - 10 months ago to 9 months ago)'],
    ['(meaning 2035)', '(meaning 2035 - in 9 years to 10 years)'],
    ['(meaning end of 2023)', '(meaning end of 2023 - 1 year ago)'],
    ['(meaning by late 2027)', '(meaning by late 2027 - in 2 years)'],
    [
      '(meaning $500 in 2024; automated $41.67/mo)',
      '(meaning $500 in 2024; automated $41.67/mo - 1 year ago to 5 months ago)',
    ],
  ])('expands %s', (note, expected) => {
    expect(expandInlineEstimatedDates(`User noted it ${note}`, now)).toBe(`User noted it ${expected}`);
  });

  it.each([
    'User listed costs (estimated 50,000+ TRY, like kitchen updates)',
    'User scoped the refactor (estimated 2000 lines of change)',
    'User asked for more (meaning raise to $2100 per month)',
  ])('leaves notes without a year unchanged: %s', input => {
    expect(expandInlineEstimatedDates(input, now)).toBe(input);
  });

  it.each([`(meaning ${' '.repeat(50_000)}`, `(meaning ${'(meaning ('.repeat(10_000)}`])(
    'stays fast on long unclosed notes',
    input => {
      const started = performance.now();
      expect(expandInlineEstimatedDates(input, now)).toBe(input);
      expect(annotateObservationTextDates(input, now)).toBe(input);
      expect(performance.now() - started).toBeLessThan(100);
    },
  );

  it('stays fast on a long run of spaces inside a closed note or a header', () => {
    const spaces = ' '.repeat(20_000);
    const started = performance.now();
    expandInlineEstimatedDates(`(meaning a${spaces}b 2024)`, now);
    addRelativeTimeToObservations(`Date: a${spaces}b`, now);
    expect(performance.now() - started).toBeLessThan(100);
  });

  it('uses forward-looking strings for future dates', () => {
    const input = `Event scheduled (estimated July 15, 2025)`;
    const result = expandInlineEstimatedDates(input, now);
    expect(result).toContain('in 1 month');
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

  describe('time zone', () => {
    // Midnight UTC is still the previous evening in Los Angeles and already morning in Tokyo
    const midnightUtc = new Date('2024-06-23T00:00:00Z');
    const observations = [
      'Date: Jun 15, 2024',
      '- User booked the exam for June 22, 2024',
      'Date: Jun 22, 2024',
      '- User will call the clinic (meaning Jun 22, 2024)',
    ].join('\n');

    it('counts days from the date in the observations time zone, not the process zone', () => {
      const result = addRelativeTimeToObservations(observations, midnightUtc, 'UTC');
      expect(result).toContain('Date: Jun 15, 2024 (1 week ago)');
      expect(result).toContain('June 22, 2024 (yesterday)');
      expect(result).toContain('Date: Jun 22, 2024 (yesterday)');
      expect(result).toContain('(meaning Jun 22, 2024 - yesterday, likely already happened)');
    });

    it('follows the observations time zone when it differs', () => {
      const result = addRelativeTimeToObservations(observations, midnightUtc, 'America/Los_Angeles');
      expect(result).toContain('Date: Jun 15, 2024 (1 week ago)');
      expect(result).toContain('Date: Jun 22, 2024 (today)');
      expect(result).toContain('(meaning Jun 22, 2024 - today)');
      // A plan for today has not happened yet, whatever the zone's clock says
      expect(result).not.toContain('likely already happened');
      expect(addRelativeTimeToObservations(observations, midnightUtc, 'Asia/Tokyo')).toContain(
        'Date: Jun 22, 2024 (yesterday)',
      );
    });

    it('falls back to the process time zone when the zone is missing or unknown', () => {
      const processZone = addRelativeTimeToObservations(observations, midnightUtc);
      expect(addRelativeTimeToObservations(observations, midnightUtc, 'Not/AZone')).toBe(processZone);
      expect(formatRelativeSpan(parseDateSpan('Jun 22, 2024')!, midnightUtc, undefined)).toBe(
        formatRelativeSpan(parseDateSpan('Jun 22, 2024')!, midnightUtc, ''),
      );
    });
  });

  it('measures gaps in calendar days, so a daylight-saving change does not shorten a week', () => {
    // US clocks sprang forward on Mar 10, 2024, so local midnights either side of that week are 7 days minus an
    // hour apart. The gap is measured in the process zone, so pin one that observes DST; in UTC the two midnights
    // are exactly 7 days apart and the test would pass either way.
    const previousZone = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    try {
      const result = addRelativeTimeToObservations('Date: Mar 5, 2024\n- a\nDate: Mar 12, 2024\n- b', now);
      expect(result).toContain('[1 week later]');
    } finally {
      if (previousZone === undefined) delete process.env.TZ;
      else process.env.TZ = previousZone;
    }
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

  it('annotates range headers and measures gaps from the end of the previous range', () => {
    const input = [
      'Date: Apr 1, 2025 - May 20, 2025',
      '- Consolidated facts',
      'Date: Jun 1, 2025',
      '- Later observation',
    ].join('\n');
    const result = addRelativeTimeToObservations(input, now);
    expect(result).toContain('Date: Apr 1, 2025 - May 20, 2025 (2 months ago to 3 weeks ago)');
    // May 20 → Jun 1 is 12 days; measuring from Apr 1 would say "1 month later"
    expect(result).toContain('[1 week later]');
  });

  it('annotates dates written into observation lines', () => {
    const input = ['Date: June 10, 2025', '- User had an exam on January 10, 2025'].join('\n');
    const result = addRelativeTimeToObservations(input, now);
    expect(result).toContain('exam on January 10, 2025 (5 months ago)');
  });

  it('handles "today" for current date', () => {
    const input = 'Date: June 15, 2025\n- Something happened';
    const result = addRelativeTimeToObservations(input, now);
    expect(result).toContain('Date: June 15, 2025 (today)');
  });
});
