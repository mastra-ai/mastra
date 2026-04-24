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

/**
 * Parses a date string like "May 30, 2023", "May 27-28, 2023", "late April 2023", etc.
 * Returns the parsed Date or null if unparseable.
 */
export function parseDateFromContent(dateContent: string): Date | null {
  let targetDate: Date | null = null;

  // Try simple date format first: "May 30, 2023"
  const simpleDateMatch = dateContent.match(/([A-Z][a-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (simpleDateMatch) {
    const parsed = new Date(`${simpleDateMatch[1]} ${simpleDateMatch[2]}, ${simpleDateMatch[3]}`);
    if (!isNaN(parsed.getTime())) {
      targetDate = parsed;
    }
  }

  // Try range format: "May 27-28, 2023" - use first date
  if (!targetDate) {
    const rangeMatch = dateContent.match(/([A-Z][a-z]+)\s+(\d{1,2})-\d{1,2},?\s+(\d{4})/);
    if (rangeMatch) {
      const parsed = new Date(`${rangeMatch[1]} ${rangeMatch[2]}, ${rangeMatch[3]}`);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }
  }

  // Try "late/early/mid Month Year" format
  if (!targetDate) {
    const vagueMatch = dateContent.match(
      /(late|early|mid)[- ]?(?:to[- ]?(?:late|early|mid)[- ]?)?([A-Z][a-z]+)\s+(\d{4})/i,
    );
    if (vagueMatch) {
      const month = vagueMatch[2];
      const year = vagueMatch[3];
      const modifier = vagueMatch[1]!.toLowerCase();
      let day = 15; // default to middle
      if (modifier === 'early') day = 7;
      if (modifier === 'late') day = 23;
      const parsed = new Date(`${month} ${day}, ${year}`);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }
  }

  // Try "Month to Month Year" format (cross-month range)
  if (!targetDate) {
    const crossMonthMatch = dateContent.match(/([A-Z][a-z]+)\s+to\s+(?:early\s+)?([A-Z][a-z]+)\s+(\d{4})/i);
    if (crossMonthMatch) {
      // Use the middle of the range - approximate with second month
      const parsed = new Date(`${crossMonthMatch[2]} 1, ${crossMonthMatch[3]}`);
      if (!isNaN(parsed.getTime())) {
        targetDate = parsed;
      }
    }
  }

  return targetDate;
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
 * Matches patterns like "(estimated May 27-28, 2023)" or "(meaning May 30, 2023)"
 * and expands them to "(meaning May 30, 2023 - which was 3 weeks ago)"
 */
export function expandInlineEstimatedDates(observations: string, currentDate: Date): string {
  // Match patterns like:
  // (estimated May 27-28, 2023)
  // (meaning May 30, 2023)
  // (estimated late April to early May 2023)
  // (estimated mid-to-late May 2023)
  // These should now be at the END of observation lines
  const inlineDateRegex = /\((estimated|meaning)\s+([^)]+\d{4})\)/gi;

  return observations.replace(inlineDateRegex, (match, prefix: string, dateContent: string, offset: number) => {
    const targetDate = parseDateFromContent(dateContent);

    if (targetDate) {
      const relative = formatRelativeTime(targetDate, currentDate);

      // Check if this is a future-intent observation that's now in the past
      // We need to look at the text BEFORE this match to determine intent
      const lineStart = observations.lastIndexOf('\n', offset) + 1;
      const lineBeforeDate = observations.slice(lineStart, offset);

      const isPastDate = targetDate < currentDate;
      const isFutureIntent = isFutureIntentObservation(lineBeforeDate);

      if (isPastDate && isFutureIntent) {
        // This was a planned action that should have happened by now
        return `(${prefix} ${dateContent} - ${relative}, likely already happened)`;
      }

      return `(${prefix} ${dateContent} - ${relative})`;
    }

    // Couldn't parse, return original
    return match;
  });
}

/**
 * Add relative time annotations to observations.
 * Transforms "Date: May 15, 2023" headers to "Date: May 15, 2023 (5 days ago)"
 * and expands inline estimated dates with relative time context.
 */
export function addRelativeTimeToObservations(observations: string, currentDate: Date): string {
  // First, expand inline estimated dates with relative time
  const withInlineDates = expandInlineEstimatedDates(observations, currentDate);

  // Match date headers like "Date: May 15, 2023" or "Date: January 1, 2024"
  const dateHeaderRegex = /^(Date:\s*)([A-Z][a-z]+ \d{1,2}, \d{4})$/gm;

  // First pass: collect all dates in order
  const dates: { index: number; date: Date; match: string; prefix: string; dateStr: string }[] = [];
  let regexMatch: RegExpExecArray | null;
  while ((regexMatch = dateHeaderRegex.exec(withInlineDates)) !== null) {
    const dateStr = regexMatch[2]!;
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      dates.push({
        index: regexMatch.index,
        date: parsed,
        match: regexMatch[0],
        prefix: regexMatch[1]!,
        dateStr,
      });
    }
  }

  // If no dates found, return the inline-expanded version
  if (dates.length === 0) {
    return withInlineDates;
  }

  // Second pass: build result with relative times and gap markers
  let result = '';
  let lastIndex = 0;

  for (let i = 0; i < dates.length; i++) {
    const curr = dates[i]!;
    const prev = i > 0 ? dates[i - 1]! : null;

    // Add text before this date header
    result += withInlineDates.slice(lastIndex, curr.index);

    // Add gap marker if there's a significant gap from previous date
    if (prev) {
      const gap = formatGapBetweenDates(prev.date, curr.date);
      if (gap) {
        result += `\n${gap}\n\n`;
      }
    }

    // Add the date header with relative time
    const relative = formatRelativeTime(curr.date, currentDate);
    result += `${curr.prefix}${curr.dateStr} (${relative})`;

    lastIndex = curr.index + curr.match.length;
  }

  // Add remaining text after last date header
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
