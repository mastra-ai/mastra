// Pure helpers for the code-section search. Kept free of CodeMirror/React so the match-finding
// and cycling logic can be unit-tested in isolation (see search-matches.test.ts). The ranges this
// produces map 1:1 onto the read-only editor document because its value is the raw code string,
// so the same `{ from, to }` offsets can drive both highlighting and scroll-to-match.

export interface MatchRange {
  from: number;
  to: number;
}

// Escapes characters with special RegExp meaning so the query is matched as a literal string.
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Finds every case-insensitive, non-overlapping occurrence of `query` in `text`, in document order.
 * Returns an empty array for an empty query (or empty text). Treats `query` as a literal string,
 * not a regular expression, so special characters are matched verbatim.
 *
 * Matching uses a case-insensitive RegExp over the original `text` rather than comparing
 * `toLowerCase()` copies, so the returned offsets stay anchored to `text`. Some Unicode characters
 * change length when lowercased (e.g. 'İ' → 'i̇'), which would otherwise shift every later index
 * and mis-highlight the wrong span.
 */
export function findMatchRanges(text: string, query: string): MatchRange[] {
  if (!query || !text) return [];

  const matcher = new RegExp(escapeRegExp(query), 'gi');
  const ranges: MatchRange[] = [];

  for (let match = matcher.exec(text); match !== null; match = matcher.exec(text)) {
    ranges.push({ from: match.index, to: match.index + match[0].length });
    // A non-empty literal query can't produce a zero-length match, but guard against an infinite
    // loop just in case `lastIndex` ever fails to advance.
    if (match.index === matcher.lastIndex) matcher.lastIndex++;
  }

  return ranges;
}

// The index-cycling logic lives with the generic match-navigation hook; re-exported here so the
// code-search module keeps a single import surface for its pure helpers.
export { getNextMatchIndex } from '@/hooks/use-match-navigation';
