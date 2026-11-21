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

/** Source code units per chunk when lowercasing the body and mapping offsets back. */
const MAP_CHUNK = 4096;

/**
 * Exact `toLowerCase()` substring matches of each word, as `[start, end)` offsets into `body`, the
 * way keyword search matches. The body is lowercased chunk by chunk, so each chunk's lowercased
 * length is known: lowercasing keeps the length for nearly all text, and where it doesn't (`İ` →
 * `i̇`) only the chunks a match lands in are walked code point by code point to map offsets back. A
 * body with no match returns before any mapping.
 */
function lowercaseHits(body: string, words: string[]): Array<{ word: number; start: number; end: number }> {
  const sourceStarts: number[] = [];
  const loweredStarts: number[] = [];
  const pieces: string[] = [];
  let loweredLength = 0;
  for (let s = 0; s < body.length;) {
    let e = Math.min(body.length, s + MAP_CHUNK);
    if (e < body.length && isHighSurrogate(body.charCodeAt(e - 1))) e++;
    const piece = body.slice(s, e).toLowerCase();
    sourceStarts.push(s);
    loweredStarts.push(loweredLength);
    pieces.push(piece);
    loweredLength += piece.length;
    s = e;
  }
  sourceStarts.push(body.length);
  loweredStarts.push(loweredLength);
  // Σ is the one character whose lowercase depends on its neighbours, which a chunk edge can hide;
  // its lowercase is one unit either way, so the chunk offsets still hold.
  const text = body.includes('Σ') ? body.toLowerCase() : pieces.join('');

  const found: Array<{ word: number; at: number; length: number }> = [];
  words.forEach((word, w) => {
    let from = 0;
    for (let n = 0; n < OCCURRENCES_PER_WORD; n++) {
      const at = text.indexOf(word, from);
      if (at < 0) break;
      found.push({ word: w, at, length: word.length });
      from = at + word.length;
    }
  });
  if (!found.length || loweredLength === body.length) {
    return found.map(({ word, at, length }) => ({ word, start: at, end: at + length }));
  }

  const walked = new Map<number, Array<{ lowered: number; source: number; width: number; lowerWidth: number }>>();
  const widths = new Map<number, number>();
  const source = (index: number, edge: 'start' | 'end') => {
    let chunk = 0;
    for (let lo = 0, hi = sourceStarts.length - 2; lo <= hi;) {
      const mid = (lo + hi) >> 1;
      if (loweredStarts[mid]! <= index) {
        chunk = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    const sourceStart = sourceStarts[chunk]!;
    const loweredStart = loweredStarts[chunk]!;
    const sourceEnd = sourceStarts[chunk + 1]!;
    if (loweredStarts[chunk + 1]! - loweredStart === sourceEnd - sourceStart) {
      return Math.min(body.length, sourceStart + (index - loweredStart));
    }
    let changes = walked.get(chunk);
    if (!changes) {
      changes = [];
      for (let i = sourceStart, l = loweredStart; i < sourceEnd;) {
        const point = body.codePointAt(i)!;
        const width = point > 0xffff ? 2 : 1;
        let lowerWidth = point < 0x80 ? 1 : widths.get(point);
        if (lowerWidth === undefined) {
          lowerWidth = String.fromCodePoint(point).toLowerCase().length;
          widths.set(point, lowerWidth);
        }
        if (lowerWidth !== width) changes.push({ lowered: l, source: i, width, lowerWidth });
        i += width;
        l += lowerWidth;
      }
      walked.set(chunk, changes);
    }
    let last = -1;
    for (let lo = 0, hi = changes.length - 1; lo <= hi;) {
      const mid = (lo + hi) >> 1;
      if (changes[mid]!.lowered <= index) {
        last = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    if (last < 0) return sourceStart + (index - loweredStart);
    const change = changes[last]!;
    const into = index - change.lowered;
    // Inside a code point whose lowercase has a different length: widen to the whole code point.
    if (into === 0) return change.source;
    if (into < change.lowerWidth) return edge === 'start' ? change.source : change.source + change.width;
    return Math.min(body.length, change.source + change.width + (into - change.lowerWidth));
  };
  return found.map(({ word, at, length }) => ({ word, start: source(at, 'start'), end: source(at + length, 'end') }));
}

/**
 * The same matches as {@link lowercaseHits} without lowercasing the body, when that is provably
 * equivalent: every word is ASCII and the body has neither `İ` (lowercases to `i̇`, does not case-fold
 * to `i`) nor `ſ` (case-folds to `s`, does not lowercase to it). For ASCII words those are the only
 * characters where Unicode case folding and lowercasing disagree. `undefined` when not equivalent.
 */
function foldedAsciiHits(
  body: string,
  words: string[],
): Array<{ word: number; start: number; end: number }> | undefined {
  if (words.some(word => /[^\x00-\x7f]/.test(word)) || /[\u0130\u017f]/.test(body)) return undefined;
  const hits: Array<{ word: number; start: number; end: number }> = [];
  words.forEach((word, w) => {
    const pattern = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
    for (let n = 0; n < OCCURRENCES_PER_WORD; n++) {
      const match = pattern.exec(body);
      if (!match) break;
      hits.push({ word: w, start: match.index, end: match.index + match[0].length });
    }
  });
  return hits;
}

const isLowSurrogate = (code: number) => code >= 0xdc00 && code <= 0xdfff;
const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;
const isSpace = (char: string | undefined) => char !== undefined && /\s/.test(char);

/**
 * A bounded excerpt of `body` around the query words, or `undefined` when the body contains none of
 * them. Uses the same words as keyword search (case-insensitive substrings). Each word's first
 * {@link OCCURRENCES_PER_WORD} occurrences anchor candidate windows; the window holding the most
 * distinct words wins, earliest on ties. A body matches exactly when `body.toLowerCase()` contains
 * the word, as in keyword search. Cost: a scan per word, plus one lowercase copy of the body unless
 * the words are ASCII and the body has no `İ` or `ſ`; offsets are mapped only for actual matches.
 */
export function knowledgeBodySnippet(body: string | undefined, query: string): string | undefined {
  if (!body) return undefined;
  const words = knowledgeSearchWords(knowledgeSearchQuery(query));
  if (!words.length) return undefined;

  const hits = foldedAsciiHits(body, words) ?? lowercaseHits(body, words);
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
