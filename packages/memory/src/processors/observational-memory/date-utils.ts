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

  return observations.replace(inlineDateRegex, (match, prefix: string, dateContent: string) => {
    const targetDate = parseDateFromContent(dateContent);

    if (targetDate) {
      const relative = formatRelativeTime(targetDate, currentDate);

      // Check if this is a future-intent observation that's now in the past
      // We need to look at the text BEFORE this match to determine intent
      const matchIndex = observations.indexOf(match);
      const lineStart = observations.lastIndexOf('\n', matchIndex) + 1;
      const lineBeforeDate = observations.substring(lineStart, matchIndex);

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
