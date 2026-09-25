import type { MastraDBMessage } from '@mastra/core/agent';

/**
 * Date/time utility functions for Observational Memory.
 * Pure functions for formatting relative timestamps and annotating observations.
 */

/**
 * Format a relative time string like "5 days ago", "2 weeks ago", "today", etc.
 */
export function formatRelativeTime(date: Date, currentDate: Date): string {
  const diffMs = currentDate.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const futureDays = Math.abs(diffDays);
    if (futureDays === 1) return 'tomorrow';
    if (futureDays < 7) return `in ${futureDays} days`;
    if (futureDays < 14) return 'in 1 week';
    if (futureDays < 30) return `in ${Math.floor(futureDays / 7)} weeks`;
    if (futureDays < 60) return 'in 1 month';
    if (futureDays < 365) return `in ${Math.floor(futureDays / 30)} months`;
    const years = Math.floor(futureDays / 365);
    return `in ${years} year${years > 1 ? 's' : ''}`;
  }

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return '1 month ago';
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} ago`;
}

/**
 * Format the gap between two dates as a human-readable string.
 * Returns null for consecutive days (no gap marker needed).
 */
export function formatGapBetweenDates(prevDate: Date, currDate: Date): string | null {
  const diffMs = currDate.getTime() - prevDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 1) {
    return null; // No gap marker for consecutive days
  } else if (diffDays < 7) {
    return `[${diffDays} days later]`;
  } else if (diffDays < 14) {
    return `[1 week later]`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `[${weeks} weeks later]`;
  } else if (diffDays < 60) {
    return `[1 month later]`;
  } else {
    const months = Math.floor(diffDays / 30);
    return `[${months} months later]`;
  }
}

/** A calendar span: a single day has `start` and `end` on the same day. */
export interface DateSpan {
  start: Date;
  end: Date;
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const MONTH = String.raw`(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?`;
const DAY = String.raw`\d{1,2}(?:st|nd|rd|th)?`;
const YEAR = String.raw`(?:19|20|21)\d{2}(?!\d)`;
const MERIDIEM = String.raw`(?:[AaPp]\.[Mm]\.|[AaPp][Mm]\b)`;
const TIME = String.raw`(?:,?\s+(?:at\s+)?\d{1,2}:\d{2}(?:\s*${MERIDIEM})?|\s+at\s+\d{1,2}\s*${MERIDIEM})`;
const QUALIFIER = String.raw`(?:(?:early|mid|late)[- ](?:to[- ](?:early|mid|late)[- ])?)`;
const RANGE_SEP = String.raw`(?:\s*[–—]\s*|\s*-\s*|\s+(?:to|through|until)\s+)`;

/**
 * Dates written into observation text that carry their own year, longest forms first:
 * "Mar 1 - Mar 18, 2025", "May 27-28, 2023", "January 10, 2024 at 3:00 PM",
 * "June–July 2022", "Dec 2021 – June 2023", "late April 2023".
 * Bare years, dates without a year, and ISO dates (often part of model IDs, API versions,
 * paths and branch names) are deliberately not matched.
 */
const FREE_TEXT_DATE = new RegExp(
  [
    String.raw`\b${MONTH}\s+${DAY}(?:,?\s+${YEAR})?${RANGE_SEP}${MONTH}\s+${DAY},?\s+${YEAR}${TIME}?`,
    String.raw`\b${MONTH}\s+${DAY}${RANGE_SEP}${DAY},?\s+${YEAR}`,
    String.raw`\b${MONTH}\s+${DAY},?\s+${YEAR}${TIME}?`,
    String.raw`\b${QUALIFIER}?${MONTH}(?:\s+${YEAR})?${RANGE_SEP}${QUALIFIER}?${MONTH}\s+${YEAR}`,
    String.raw`\b${QUALIFIER}?${MONTH}\s+${YEAR}`,
  ].join('|'),
  'g',
);

interface PartialDate {
  qualifier?: 'early' | 'mid' | 'late';
  month?: number;
  day?: number;
  year?: number;
}

const ENDPOINT = new RegExp(
  String.raw`^(?:(early|mid|late)\s*)?(?:(${MONTH})\s*)?(?:(\d{1,2})(?:st|nd|rd|th)?)?,?\s*(?:(${YEAR}))?$`,
  'i',
);

function parseEndpoint(text: string): PartialDate | null {
  const match = ENDPOINT.exec(text.trim());
  if (!match || !match[0]) return null;
  const [, qualifier, month, day, year] = match;
  return {
    ...(qualifier ? { qualifier: qualifier.toLowerCase() as PartialDate['qualifier'] } : {}),
    ...(month ? { month: MONTH_INDEX[month.slice(0, 3).toLowerCase()] } : {}),
    ...(day ? { day: Number(day) } : {}),
    ...(year ? { year: Number(year) } : {}),
  };
}

const QUALIFIER_DAY = { early: 7, mid: 15, late: 23 } as const;
const QUALIFIER_MONTH = { early: [1, 15], mid: [6, 1], late: [10, 15] } as const;

/** Earliest and latest local day an endpoint can mean; null when it has no year or is not a real date. */
function endpointBounds(date: PartialDate): [Date, Date] | null {
  const { qualifier, month, day, year } = date;
  if (year === undefined) return null;
  if (month === undefined) {
    if (day !== undefined) return null;
    if (qualifier) {
      const [m, d] = QUALIFIER_MONTH[qualifier];
      return [new Date(year, m, d), new Date(year, m, d)];
    }
    return [new Date(year, 0, 1), new Date(year, 11, 31)];
  }
  if (day !== undefined) {
    const point = new Date(year, month, day);
    if (point.getMonth() !== month) return null;
    return [point, point];
  }
  if (qualifier) {
    const point = new Date(year, month, QUALIFIER_DAY[qualifier]);
    return [point, point];
  }
  return [new Date(year, month, 1), new Date(year, month + 1, 0)];
}

/** Parses one alternative: a single date or a two-ended range, filling each end's missing parts from the other. */
function parseSpanAlternative(text: string): DateSpan | null {
  const ends = text.split(new RegExp(`${RANGE_SEP}(?=\\S)`)).filter(Boolean);
  if (ends.length === 0 || ends.length > 2) return null;

  const parsed = ends.map(parseEndpoint);
  if (parsed.some(end => end === null)) return null;
  const [first, second = first] = parsed as PartialDate[];
  const from = { ...first! };
  const to = { ...second };

  const fromYearInferred = from.year === undefined;
  const toYearInferred = to.year === undefined;
  from.year ??= to.year;
  to.year ??= from.year;
  if (from.month === undefined && (from.day !== undefined || from.qualifier) && to.month !== undefined) {
    from.month = to.month;
  }
  if (to.month === undefined && to.day !== undefined && from.month !== undefined) to.month = from.month;

  // A range that crosses New Year with one stated year ("Dec 27 – Jan 3, 2025") puts the other end in the adjacent year.
  if (from.month !== undefined && to.month !== undefined && from.month > to.month && from.year === to.year) {
    if (fromYearInferred) from.year! -= 1;
    else if (toYearInferred) to.year! += 1;
  }

  const fromBounds = endpointBounds(from);
  const toBounds = endpointBounds(to);
  if (!fromBounds || !toBounds) return null;
  const span = { start: fromBounds[0], end: toBounds[1] };
  return span.start <= span.end ? span : null;
}

function normalizeDateText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:approx(?:\.|imately)?|about|around|circa|c\.|~)\s*/i, '')
    .replace(/^(?:by|in|until|before|after)\s+/i, '')
    .replace(/\b(?:the\s+)?end\s+of\s+/gi, 'late ')
    .replace(/\b(?:the\s+)?(?:start|beginning)\s+of\s+/gi, 'early ')
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (whole, y: string, m: string, d: string) => {
      const month = Object.keys(MONTH_INDEX)[Number(m) - 1];
      return month ? `${month} ${Number(d)}, ${y}` : whole;
    })
    .replace(new RegExp(TIME, 'g'), '')
    .replace(/\b(early|mid|late|to)-/gi, '$1 ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/**
 * Parses the whole of `text` as a date or date range. Accepts "May 30, 2023",
 * "Mar 22, 2025 at 18:08", "May 27-28, 2023", "Dec 27–31, 2021", "Mar 1 - Mar 18, 2025",
 * "Aug 1, 2024 - Feb 28, 2025", "August 2024", "June–July 2022", "late April 2023",
 * "mid-to-late May 2023", "late 2023", "2035", "2021–2026", an "approx." prefix, and
 * "A or B" alternatives (their union). Returns null when no year is known.
 */
export function parseDateSpan(text: string): DateSpan | null {
  const alternatives = normalizeDateText(text)
    .split(/\s+or\s+/i)
    .map(parseSpanAlternative);
  if (alternatives.length === 0 || alternatives.some(span => span === null)) return null;
  const spans = alternatives as DateSpan[];
  return {
    start: new Date(Math.min(...spans.map(span => span.start.getTime()))),
    end: new Date(Math.max(...spans.map(span => span.end.getTime()))),
  };
}

const QUALIFIED_YEAR = new RegExp(
  String.raw`\b(?:by|in|until|before|after|(?:the\s+)?(?:early|mid|late|end\s+of|start\s+of|beginning\s+of))\s+${YEAR}`,
  'gi',
);

/**
 * Like `parseDateSpan`, but falls back to the first dated expression inside longer text,
 * then to a year on its own ("by late 2027", "$500 in 2024"). Only for text known to be a date.
 */
function findDateSpan(text: string): DateSpan | null {
  const whole = parseDateSpan(text);
  if (whole) return whole;
  for (const pattern of [FREE_TEXT_DATE, QUALIFIED_YEAR]) {
    for (const match of text.matchAll(pattern)) {
      const span = parseDateSpan(match[0]);
      if (span) return span;
    }
  }
  return null;
}

/**
 * Parses a date string like "May 30, 2023", "May 27-28, 2023", "late April 2023", etc.
 * Returns the start of the date or range, or null if unparseable or the year is unknown.
 */
export function parseDateFromContent(dateContent: string): Date | null {
  return findDateSpan(dateContent)?.start ?? null;
}

/** Relative time for a span: "3 weeks ago", or "7 months ago to 4 weeks ago" when the ends differ. */
export function formatRelativeSpan(span: DateSpan, currentDate: Date): string {
  const start = formatRelativeTime(span.start, currentDate);
  const end = formatRelativeTime(span.end, currentDate);
  if (start === end) return start;
  if (!end.startsWith('in ')) return `${start} to ${end}`;
  return start.startsWith('in ') ? `${start} to ${end.slice(3)}` : `${start} to ${end.slice(3)} from now`;
}

/**
 * Detects if an observation line indicates future intent (will do, plans to, looking forward to, etc.)
 */
export function isFutureIntentObservation(line: string): boolean {
  const futureIntentPatterns = [
    /\bwill\s+(?:be\s+)?(?:\w+ing|\w+)\b/i,
    /\bplans?\s+to\b/i,
    /\bplanning\s+to\b/i,
    /\blooking\s+forward\s+to\b/i,
    /\bgoing\s+to\b/i,
    /\bintends?\s+to\b/i,
    /\bwants?\s+to\b/i,
    /\bneeds?\s+to\b/i,
    /\babout\s+to\b/i,
  ];
  return futureIntentPatterns.some(pattern => pattern.test(line));
}

/**
 * Expand inline estimated dates with relative time.
 * Matches patterns like "(estimated May 27-28, 2023)" or "(meaning May 30, 2023 at 3:00 PM)"
 * and expands them to "(meaning May 30, 2023 - 3 weeks ago)". Notes without a year are left alone.
 */
export function expandInlineEstimatedDates(observations: string, currentDate: Date): string {
  const inlineDateRegex = /\((estimated|meaning)\s([^()]*)\)/gi;

  return observations.replace(inlineDateRegex, (match, prefix: string, noteText: string, offset: number) => {
    const dateContent = noteText.trimStart();
    const span = findDateSpan(dateContent);
    if (!span) return match;

    const relative = formatRelativeSpan(span, currentDate);

    // A planned action whose date has passed has likely happened; the intent is in the text before the note.
    const lineStart = observations.lastIndexOf('\n', offset) + 1;
    const lineBeforeDate = observations.slice(lineStart, offset);
    if (span.end < currentDate && isFutureIntentObservation(lineBeforeDate)) {
      return `(${prefix} ${dateContent} - ${relative}, likely already happened)`;
    }

    return `(${prefix} ${dateContent} - ${relative})`;
  });
}

/**
 * Annotates dates written into observation text, e.g. "exam on January 10, 2024" becomes
 * "exam on January 10, 2024 (5 months ago)". Only dates that state their year are annotated;
 * "Date:" headers and "(meaning/estimated …)" notes are handled separately and skipped here.
 */
export function annotateObservationTextDates(observations: string, currentDate: Date): string {
  const regex = new RegExp(
    String.raw`^Date:.*$|\((?:[Ee]stimated|[Mm]eaning)\b[^()]*\)|${FREE_TEXT_DATE.source}`,
    'gm',
  );
  return observations.replace(regex, (match, offset: number) => {
    if (match.startsWith('Date:') || match.startsWith('(')) return match;
    const span = parseDateSpan(match);
    if (!span) return match;
    const relative = formatRelativeSpan(span, currentDate);
    // A date closing a parenthetical takes the "(… - 3 weeks ago)" form rather than nesting parentheses.
    return observations[offset + match.length] === ')' ? `${match} - ${relative}` : `${match} (${relative})`;
  });
}

/**
 * Add relative time annotations to observations.
 * Transforms "Date: May 15, 2023" headers to "Date: May 15, 2023 (5 days ago)", range headers such as
 * "Date: Aug 1, 2024 - Feb 28, 2025" to "(7 months ago to 4 weeks ago)", and annotates inline dates.
 */
export function addRelativeTimeToObservations(observations: string, currentDate: Date): string {
  const withInlineDates = annotateObservationTextDates(
    expandInlineEstimatedDates(observations, currentDate),
    currentDate,
  );

  const dateHeaderRegex = /^(Date:[ \t]*)(.*)$/gm;

  // First pass: collect every header that parses as a date or range, in order
  const dates: { index: number; span: DateSpan; match: string; prefix: string; dateStr: string }[] = [];
  let regexMatch: RegExpExecArray | null;
  while ((regexMatch = dateHeaderRegex.exec(withInlineDates)) !== null) {
    const dateStr = regexMatch[2]!.trimEnd();
    const span = parseDateSpan(dateStr);
    if (span) {
      dates.push({ index: regexMatch.index, span, match: regexMatch[0], prefix: regexMatch[1]!, dateStr });
    }
  }

  if (dates.length === 0) {
    return withInlineDates;
  }

  // Second pass: build result with relative times and gap markers
  let result = '';
  let lastIndex = 0;

  for (let i = 0; i < dates.length; i++) {
    const curr = dates[i]!;
    const prev = i > 0 ? dates[i - 1]! : null;

    result += withInlineDates.slice(lastIndex, curr.index);

    // The gap runs from where the previous header's span ends to where this one starts
    if (prev) {
      const gap = formatGapBetweenDates(prev.span.end, curr.span.start);
      if (gap) {
        result += `\n${gap}\n\n`;
      }
    }

    result += `${curr.prefix}${curr.dateStr} (${formatRelativeSpan(curr.span, currentDate)})`;

    lastIndex = curr.index + curr.match.length;
  }

  result += withInlineDates.slice(lastIndex);

  return result;
}

export const MIN_TEMPORAL_GAP_MS = 10 * 60 * 1000;

export function formatTemporalGap(diffMs: number): string | null {
  if (diffMs < MIN_TEMPORAL_GAP_MS) return null;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  const formatUnit = (value: number, unit: string) => `${value} ${unit}${value === 1 ? '' : 's'}`;

  if (diffMs < hour) {
    const minutes = Math.max(1, Math.round(diffMs / minute));
    return `${formatUnit(minutes, 'minute')} later`;
  }

  const formatTwoUnits = (primaryMs: number, primaryUnit: string, secondaryMs: number, secondaryUnit: string) => {
    const primary = Math.floor(diffMs / primaryMs);
    const remainder = diffMs - primary * primaryMs;
    const secondary = Math.floor(remainder / secondaryMs);
    const parts = [formatUnit(primary, primaryUnit)];

    if (secondary > 0) {
      parts.push(formatUnit(secondary, secondaryUnit));
    }

    return `${parts.join(' ')} later`;
  };

  if (diffMs < day) {
    return formatTwoUnits(hour, 'hour', minute, 'minute');
  }

  if (diffMs < week) {
    return formatTwoUnits(day, 'day', hour, 'hour');
  }

  if (diffMs < month) {
    return formatTwoUnits(week, 'week', day, 'day');
  }

  if (diffMs < year) {
    return formatTwoUnits(month, 'month', week, 'week');
  }

  return formatTwoUnits(year, 'year', month, 'month');
}

export function formatTemporalTimestamp(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
}

export function getMessagePartTimestamp(msg: MastraDBMessage, position: 'first' | 'last'): number {
  const timestamps = msg.content?.parts
    ?.map(part => ('createdAt' in part ? part.createdAt : undefined))
    .filter((timestamp): timestamp is number => typeof timestamp === 'number');

  if (timestamps && timestamps.length > 0) {
    const index = position === 'first' ? 0 : timestamps.length - 1;
    const timestamp = timestamps[index];
    if (timestamp !== undefined) return timestamp;
  }

  return new Date(msg.createdAt).getTime();
}

export function isTemporalGapMarker(msg: MastraDBMessage): boolean {
  return msg.id.startsWith('__temporal_');
}
