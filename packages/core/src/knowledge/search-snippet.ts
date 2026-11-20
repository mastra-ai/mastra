import { knowledgeSearchWords } from '@internal/core/knowledge-compat';

/** Longest body excerpt a search hit shows, before the `…` markers. */
export const KNOWLEDGE_SNIPPET_MAX_CHARS = 240;
/** Occurrences of each query word sampled as window anchors. */
const OCCURRENCES_PER_WORD = 32;
/** Characters of context kept before the anchoring match. */
const LEAD_CHARS = 60;
/** How far a window edge may move to land on whitespace. */
const SNAP_CHARS = 20;

/**
 * The words `knowledge_search` searches for: keyword search has no quoting, so quote marks become
 * spaces (`"refund" policy` searches `refund policy`).
 */
export function knowledgeSearchQuery(query: string): string {
  return query.replace(/["`\u201C\u201D]/g, ' ').trim();
}

/**
 * Lowercases `body` for matching, and maps a lowercased index back to the source. Lowercasing keeps
 * the length for nearly all text; where a code point changes length (e.g. `İ` → `i̇`), a shift is
 * recorded, so mapping back is a binary search over those few points rather than a per-character map.
 */
function lowered(body: string): { text: string; source: (index: number) => number } {
  const text = body.toLowerCase();
  if (text.length === body.length) return { text, source: index => index };
  const shifts: Array<{ lowered: number; source: number }> = [];
  const widths = new Map<number, number>();
  let delta = 0;
  for (let i = 0; i < body.length;) {
    if (body.charCodeAt(i) < 0x80) {
      i++;
      continue;
    }
    const point = body.codePointAt(i)!;
    const width = point > 0xffff ? 2 : 1;
    let lowerWidth = widths.get(point);
    if (lowerWidth === undefined) {
      lowerWidth = String.fromCodePoint(point).toLowerCase().length;
      widths.set(point, lowerWidth);
    }
    i += width;
    if (lowerWidth !== width) {
      delta += lowerWidth - width;
      shifts.push({ lowered: i + delta, source: i });
    }
  }
  return {
    text,
    source: index => {
      let lo = 0;
      let hi = shifts.length - 1;
      let found = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (shifts[mid]!.lowered <= index) {
          found = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      const shift = found < 0 ? 0 : shifts[found]!.lowered - shifts[found]!.source;
      return Math.min(body.length, Math.max(0, index - shift));
    },
  };
}

const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;
const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isSpace = (char: string | undefined) => char !== undefined && /\s/.test(char);

/**
 * A bounded excerpt of `body` around the query words, or `undefined` when the body contains none of
 * them. Uses the same words as keyword search (case-insensitive substrings). Each word's first
 * {@link OCCURRENCES_PER_WORD} occurrences anchor candidate windows; the window holding the most
 * distinct words wins, earliest on ties. Cost is one lowercase copy plus at most one linear scan per
 * word: a body with no match is scanned once per word, end to end.
 */
export function knowledgeBodySnippet(body: string | undefined, query: string): string | undefined {
  if (!body) return undefined;
  const words = knowledgeSearchWords(knowledgeSearchQuery(query));
  if (!words.length) return undefined;

  const { text, source } = lowered(body);

  const hits: Array<{ word: number; start: number; end: number }> = [];
  words.forEach((word, w) => {
    let from = 0;
    for (let n = 0; n < OCCURRENCES_PER_WORD; n++) {
      const at = text.indexOf(word, from);
      if (at < 0) break;
      hits.push({ word: w, start: source(at), end: source(at + word.length) });
      from = at + word.length;
    }
  });
  if (!hits.length) return undefined;

  let best: { start: number; anchor: number; score: number } | undefined;
  for (const hit of hits) {
    const start = Math.max(0, hit.start - LEAD_CHARS);
    const end = start + KNOWLEDGE_SNIPPET_MAX_CHARS;
    const seen = new Set<number>();
    for (const other of hits) if (other.start >= start && other.end <= end) seen.add(other.word);
    const score = seen.size;
    if (!best || score > best.score || (score === best.score && start < best.start)) {
      best = { start, anchor: hit.start, score };
    }
  }

  let start = best!.start;
  let end = Math.min(body.length, start + KNOWLEDGE_SNIPPET_MAX_CHARS);
  if (start > 0) {
    // Start on a word, without moving past the match.
    for (let i = start; i < Math.min(best!.anchor, start + SNAP_CHARS); i++) {
      if (isSpace(body[i])) {
        start = i + 1;
        break;
      }
    }
  }
  if (end < body.length) {
    for (let i = end; i > Math.max(best!.anchor, end - SNAP_CHARS); i--) {
      if (isSpace(body[i - 1])) {
        end = i - 1;
        break;
      }
    }
  }
  if (start < body.length && isLowSurrogate(body.charCodeAt(start))) start++;
  if (end > start && isHighSurrogate(body.charCodeAt(end - 1))) end--;

  return `${start > 0 ? '…' : ''}${body.slice(start, end)}${end < body.length ? '…' : ''}`;
}
