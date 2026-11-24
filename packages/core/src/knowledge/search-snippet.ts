import { knowledgeSearchWords } from '@internal/core/knowledge-compat';
import { estimateTokenCount, sliceByTokens } from 'tokenx';
import { KnowledgeBodyLines, knowledgeBodySections } from './page-body';

/**
 * Most estimated tokens of body text a search hit's excerpt shows, before the `…` markers and the
 * heading line. Counted with the same estimator as `knowledge_read`'s budget.
 */
export const KNOWLEDGE_SNIPPET_TOKENS = 60;
/** Longest heading line a hit shows ahead of its excerpt; a longer one is cut with `…`. */
const HEADING_CHARS = 120;
/** Characters of body looked at past a window's start when fitting it to the token budget. */
// 12 chars per token is a deliberate upper bound for dense text; don't lower it with the token count.
const WINDOW_SCAN_CHARS = KNOWLEDGE_SNIPPET_TOKENS * 12;
/** Occurrences of each query word sampled as window anchors. */
const OCCURRENCES_PER_WORD = 32;
/** Estimated tokens of context kept before the anchoring match. */
const LEAD_TOKENS = 15;
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
function lowercaseHits(
  body: string,
  words: string[],
): { hits: Array<{ word: number; start: number; end: number }>; text: string } {
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
    return { hits: found.map(({ word, at, length }) => ({ word, start: at, end: at + length })), text };
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
  return {
    hits: found.map(({ word, at, length }) => ({ word, start: source(at, 'start'), end: source(at + length, 'end') })),
    text,
  };
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

/** How many lines of a search hit's body have a matched word. */
function matchingLines(body: string, words: string[], lowered: string | undefined) {
  // Lowercasing never adds or removes a `\n`, so line numbers are the same in the lowered copy.
  const pattern = lowered
    ? undefined
    : new RegExp(words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'iu');
  let count = 0;
  (lowered ?? body).split('\n').forEach((line, i) => {
    if (!(pattern ? pattern.test(line) : words.some(word => line.includes(word)))) return;
    count++;
  });
  return count;
}

/**
 * The nearest markdown heading above body offset `at`, as `12│## Heading` with its `knowledge_read`
 * line number, unless the heading starts inside the excerpt that begins at `windowStart`.
 */
function headingAbove(body: string, at: number, windowStart: number, width: number): string | undefined {
  let nearest: { start: number } | undefined;
  for (const section of knowledgeBodySections(body)) {
    if (section.start > at) break;
    nearest = section;
  }
  if (!nearest || nearest.start >= windowStart) return undefined;
  const lines = new KnowledgeBodyLines(body);
  const line = lines.lineAt(nearest.start);
  const text = body.slice(nearest.start, lines.lineEnd(line));
  return `${String(line).padStart(width)}│${
    text.length > HEADING_CHARS
      ? `${Array.from(text)
          .slice(0, HEADING_CHARS - 1)
          .join('')}…`
      : text
  }`;
}

/** A search hit's view of a page body: an excerpt around the matched words, and where the matches are. */
export interface KnowledgeBodyHit {
  /** An excerpt of {@link KNOWLEDGE_SNIPPET_TOKENS} tokens, every line numbered as `knowledge_read` numbers lines, with the heading it sits under first when that is out of view. */
  snippet: string;
  /** The line (as `knowledge_read` numbers lines) of the match the excerpt is centred on. */
  line: number;
  /** How many lines contain a matched word. */
  matchingLines: number;
}

/**
 * Where `body` matches the query words, or `undefined` when it contains none of them. Uses the same
 * words and the same rule as keyword search (case-insensitive substrings: a body matches exactly
 * when `body.toLowerCase()` contains the word). Each word's first {@link OCCURRENCES_PER_WORD}
 * occurrences anchor candidate windows of {@link KNOWLEDGE_SNIPPET_TOKENS} tokens; the window
 * holding the most distinct words wins, earliest on ties. Lines are counted over the whole body.
 * Cost: a scan per word and one lowercase copy of the body, except for ASCII words in a body with
 * no `İ` or `ſ`, which are matched without lowercasing; offsets are mapped only for actual matches.
 */
export function knowledgeBodyHit(body: string | undefined, query: string): KnowledgeBodyHit | undefined {
  if (!body) return undefined;
  const words = knowledgeSearchWords(knowledgeSearchQuery(query));
  if (!words.length) return undefined;

  const folded = foldedAsciiHits(body, words);
  const lowercase = folded ? undefined : lowercaseHits(body, words);
  const hits = folded ?? lowercase!.hits;
  if (!hits.length) return undefined;

  const windowEnd = (start: number) => {
    const rest = body.slice(start, start + WINDOW_SCAN_CHARS);
    return (
      start +
      (estimateTokenCount(rest) <= KNOWLEDGE_SNIPPET_TOKENS
        ? rest.length
        : sliceByTokens(rest, 0, KNOWLEDGE_SNIPPET_TOKENS).length)
    );
  };
  let best: { start: number; end: number; anchor: number; score: number } | undefined;
  for (const hit of hits) {
    const before = body.slice(Math.max(0, hit.start - LEAD_TOKENS * 12), hit.start);
    const start = hit.start - sliceByTokens(before, -LEAD_TOKENS).length;
    const end = Math.max(windowEnd(start), hit.end);
    const seen = new Set<number>();
    for (const other of hits) if (other.start >= start && other.end <= end) seen.add(other.word);
    const score = seen.size;
    if (!best || score > best.score || (score === best.score && start < best.start)) {
      best = { start, end, anchor: hit.start, score };
    }
  }

  let { start, end } = best!;
  const { anchor } = best!;
  if (start > 0) {
    // Start on a word, without moving past the match.
    for (let i = start; i < Math.min(anchor, start + SNAP_CHARS); i++) {
      if (isSpace(body[i])) {
        start = i + 1;
        break;
      }
    }
  }
  if (end < body.length) {
    for (let i = end; i > Math.max(anchor, end - SNAP_CHARS); i--) {
      if (isSpace(body[i - 1])) {
        end = i - 1;
        break;
      }
    }
  }
  if (start < body.length && isLowSurrogate(body.charCodeAt(start))) start++;
  if (end > start && isHighSurrogate(body.charCodeAt(end - 1))) end--;

  // Number every line the way `knowledge_read` does; a cut first or last line keeps its number and gets the `…`.
  const lines = new KnowledgeBodyLines(body);
  const rows = lines.numbered(start, end > start && body[end - 1] === '\n' ? end - 1 : end).split('\n');
  const width = rows[0]!.indexOf('│');
  if (start > 0) rows[0] = `${rows[0]!.slice(0, width + 1)}…${rows[0]!.slice(width + 1)}`;
  if (end < body.length) rows[rows.length - 1] += '…';
  const heading = headingAbove(body, anchor, start, width);
  const matches = matchingLines(body, words, lowercase?.text);
  return {
    snippet: heading ? `${heading}\n${rows.join('\n')}` : rows.join('\n'),
    line: lines.lineAt(anchor),
    matchingLines: matches,
  };
}
