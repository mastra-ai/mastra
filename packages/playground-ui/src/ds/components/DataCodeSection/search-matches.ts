// Pure helpers for the code-section search. Kept free of CodeMirror/React so the match-finding
// and cycling logic can be unit-tested in isolation (see search-matches.test.ts). The ranges this
// produces map 1:1 onto the read-only editor document because its value is the raw code string,
// so the same `{ from, to }` offsets can drive both highlighting and scroll-to-match.

export interface MatchRange {
  from: number;
  to: number;
}

/**
 * Finds every case-insensitive, non-overlapping occurrence of `query` in `text`, in document order.
 * Returns an empty array for an empty query (or empty text). Treats `query` as a literal string,
 * not a regular expression, so special characters are matched verbatim.
 */
export function findMatchRanges(text: string, query: string): MatchRange[] {
  if (!query || !text) return [];

  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  const ranges: MatchRange[] = [];

  let from = haystack.indexOf(needle);
  while (from !== -1) {
    const to = from + needle.length;
    ranges.push({ from, to });
    // Advance past this match so occurrences never overlap (mirrors CodeMirror's SearchCursor).
    from = haystack.indexOf(needle, to);
  }

  return ranges;
}

/**
 * Returns the index of the next match when stepping `direction` (1 = forward, -1 = backward) from
 * `current`, wrapping around at both ends (like a browser's find bar). Returns -1 when there are no
 * matches so callers can treat "no active match" uniformly.
 */
export function getNextMatchIndex(current: number, count: number, direction: 1 | -1): number {
  if (count <= 0) return -1;
  return (current + direction + count) % count;
}
