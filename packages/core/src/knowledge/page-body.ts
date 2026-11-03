import { estimateTokenCount, sliceByTokens } from 'tokenx';

/**
 * Default most estimated tokens one `knowledge_read` or `knowledge_list` result returns; the rest
 * comes by `from` or `cursor`. Set per Knowledge with `tools.read.maxTokens`.
 */
export const KNOWLEDGE_READ_BODY_TOKENS = 1_000;
/**
 * Most estimated tokens of notes, or of mentioning notes, a whole-page read carries inline. Past it
 * the list is left out with a count, and read on its own with `notes` or `mentionedIn`.
 */
export const KNOWLEDGE_READ_INLINE_TOKENS = 1_000;
/** Most headings one outline lists. */
export const KNOWLEDGE_READ_OUTLINE_ENTRIES = 200;
/** Most estimated tokens of headings a first read cut short lists for the part of the body it did not reach. */
export const KNOWLEDGE_READ_REST_OUTLINE_TOKENS = 500;

/** A markdown heading's section: from its heading line to the next heading at its level or above. */
export interface KnowledgeBodySection {
  level: number;
  title: string;
  /** Character range in the body, heading line included. */
  start: number;
  end: number;
}

// A closing run of `#` only counts when whitespace comes before it, so `## Use C#` keeps its `#`.
const HEADING = /^(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/;
// CommonMark allows up to three spaces before a fence; four or more is an indented code line.
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/**
 * Tracks fenced code line by line: returns the open fence after `line`, given the one open before
 * it. A fence closes only on a run of the same character at least as long, with nothing after it.
 */
function nextFence(open: string | undefined, line: string): string | undefined {
  const fence = FENCE.exec(line);
  if (!fence) return open;
  if (open === undefined) return fence[1];
  const closes = fence[1]![0] === open[0] && fence[1]!.length >= open.length && !fence[2]!.trim();
  return closes ? undefined : open;
}

/** Markdown sections by ATX heading, in body order; headings inside fenced code are ignored. */
export function knowledgeBodySections(body: string): KnowledgeBodySection[] {
  const headings: Array<{ level: number; title: string; start: number }> = [];
  let fence: string | undefined;
  let at = 0;
  for (const line of body.split('\n')) {
    const fenced = FENCE.test(line);
    if (!fenced && fence === undefined) {
      const heading = HEADING.exec(line);
      if (heading) headings.push({ level: heading[1]!.length, title: heading[2]!.trim(), start: at });
    }
    fence = nextFence(fence, line);
    at += line.length + 1;
  }
  return headings.map((heading, i) => {
    const next = headings.slice(i + 1).find(candidate => candidate.level <= heading.level);
    return { ...heading, end: next ? next.start : body.length };
  });
}

/** Each heading with its section's size, for an agent to pick one. */
export function knowledgeBodyOutline(body: string) {
  const lines = new KnowledgeBodyLines(body);
  return knowledgeBodySections(body).map(section => ({
    level: section.level,
    title: section.title,
    line: lines.lineAt(section.start),
    tokens: estimateTokenCount(body.slice(section.start, section.end)),
  }));
}

/** The section titled `title`: an exact (case-insensitive) title first, else the only title containing it. */
export function knowledgeBodySection(
  body: string,
  title: string,
): { section: KnowledgeBodySection } | { candidates: string[] } {
  const sections = knowledgeBodySections(body);
  const wanted = title
    .trim()
    .replace(/^#+\s*/, '')
    .toLowerCase();
  const exact = sections.filter(section => section.title.toLowerCase() === wanted);
  if (exact.length >= 1) return { section: exact[0]! };
  const partial = sections.filter(section => section.title.toLowerCase().includes(wanted));
  if (partial.length === 1) return { section: partial[0]! };
  return { candidates: (partial.length ? partial : sections).map(section => section.title).slice(0, 10) };
}

/** A place in a body: a 1-based line, and optionally a 0-based character column in it. */
export interface KnowledgeLinePosition {
  line: number;
  col?: number;
}

/**
 * Part of a body by line. Without columns it is whole lines, `start.line` through `end.line`.
 * `start.col` is the first character it covers and `end.col` the character after its last.
 */
export interface KnowledgeLineRange {
  start: KnowledgeLinePosition;
  end: KnowledgeLinePosition;
}

/** A body's lines: split on `\n`, a final newline not counting as one more, empty body none. */
export class KnowledgeBodyLines {
  readonly starts: number[] = [];

  constructor(readonly body: string) {
    if (!body) return;
    this.starts.push(0);
    for (let at = body.indexOf('\n'); at !== -1 && at + 1 < body.length; at = body.indexOf('\n', at + 1)) {
      this.starts.push(at + 1);
    }
  }

  get count(): number {
    return this.starts.length;
  }

  /** Character offset where line `n`'s text ends, before its newline. */
  lineEnd(n: number): number {
    const next = this.starts[n];
    return next === undefined ? (this.body.endsWith('\n') ? this.body.length - 1 : this.body.length) : next - 1;
  }

  /** The line holding character `offset`; an offset at a line's end belongs to that line. */
  lineAt(offset: number): number {
    let low = 0;
    let high = this.starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (this.starts[mid]! <= offset) low = mid;
      else high = mid - 1;
    }
    return low + 1;
  }

  /** Where a range starts, as a body offset; throws when it isn't in the body. */
  startOffset(at: KnowledgeLinePosition): number {
    this.#check(at);
    return this.starts[at.line - 1]! + (at.col ?? 0);
  }

  /** Where a range ends, as a body offset: without a column, the end of that line's text. */
  endOffset(at: KnowledgeLinePosition): number {
    this.#check(at);
    return at.col === undefined ? this.lineEnd(at.line) : this.starts[at.line - 1]! + at.col;
  }

  /** The position of a start offset: its line, with a column only when it isn't the line's start. */
  startPosition(offset: number): KnowledgeLinePosition {
    const line = this.lineAt(offset);
    const col = offset - this.starts[line - 1]!;
    return col ? { line, col } : { line };
  }

  /** The position of an end offset: its line, with a column only when it isn't the line's end. */
  endPosition(offset: number): KnowledgeLinePosition {
    const line = this.lineAt(offset);
    return offset >= this.lineEnd(line) ? { line } : { line, col: offset - this.starts[line - 1]! };
  }

  /** Body characters `start` to `end`, each line prefixed with its number: `12│text`. */
  numbered(start: number, end: number): string {
    const first = this.lineAt(start);
    const last = this.lineAt(end);
    const width = String(last).length;
    const out: string[] = [];
    for (let n = first; n <= last; n++) {
      const from = Math.max(start, this.starts[n - 1]!);
      const to = Math.min(end, this.lineEnd(n));
      out.push(`${String(n).padStart(width)}│${this.body.slice(from, to)}`);
    }
    return out.join('\n');
  }

  #check(at: KnowledgeLinePosition) {
    if (!Number.isInteger(at.line) || at.line < 1 || at.line > this.count) {
      throw new Error(`Line ${at.line} is outside the body, which has ${this.count} lines.`);
    }
    const length = this.lineEnd(at.line) - this.starts[at.line - 1]!;
    if (at.col !== undefined && (!Number.isInteger(at.col) || at.col < 0 || at.col > length)) {
      throw new Error(`Column ${at.col} is outside line ${at.line}, which has ${length} characters.`);
    }
  }
}

/**
 * What one read returns from body character `start`, up to `limit`: at most `maxTokens`
 * (default {@link KNOWLEDGE_READ_BODY_TOKENS}), ended at the last whole line that fits. Only a line too long
 * for one read is cut inside it, never splitting a surrogate pair. `next` is where the rest starts.
 */
export function knowledgeBodyWindow(
  lines: KnowledgeBodyLines,
  start: number,
  limit = lines.body.length,
  maxTokens = KNOWLEDGE_READ_BODY_TOKENS,
): { start: number; end: number; next?: number } {
  const rest = lines.body.slice(start, limit);
  if (estimateTokenCount(rest) <= maxTokens) return { start, end: limit };
  let end = start + sliceByTokens(rest, 0, maxTokens).length;
  const newline = lines.body.lastIndexOf('\n', end - 1);
  if (newline >= start) return { start, end: newline, next: newline + 1 };
  const last = lines.body.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end--;
  return { start, end, next: end };
}

/** A line longer than this shows only the characters around a match. */
export const KNOWLEDGE_READ_MATCH_LINE_CHARS = 400;

/**
 * The lines that contain any of `terms` (case-insensitive), from body character `from`, each with
 * `context` lines before and after, overlapping hits merged. Lines longer than
 * {@link KNOWLEDGE_READ_MATCH_LINE_CHARS} are never shown whole: a matching one gives the
 * characters around its first match, a non-matching one is left out. Each part is a body range a
 * write can take back as it is.
 */
export function knowledgeBodyGrep(
  lines: KnowledgeBodyLines,
  terms: string[],
  context: number,
  from = 0,
): Array<{ start: number; end: number }> {
  const needles = terms.map(term => term.toLowerCase()).filter(Boolean);
  const text = (n: number) => lines.body.slice(lines.starts[n - 1]!, lines.lineEnd(n)).toLowerCase();
  const firstLine = lines.lineAt(from);
  const spans: Array<[number, number]> = [];
  for (let n = firstLine; n <= lines.count; n++) {
    if (!needles.some(needle => text(n).includes(needle))) continue;
    const span: [number, number] = [Math.max(firstLine, n - context), Math.min(lines.count, n + context)];
    const last = spans[spans.length - 1];
    if (last && span[0] <= last[1] + 1) last[1] = span[1];
    else spans.push(span);
  }
  const parts: Array<{ start: number; end: number }> = [];
  for (const [first, last] of spans) {
    let run: number | undefined;
    const close = (n: number) => {
      if (run !== undefined) parts.push({ start: lines.starts[run - 1]!, end: lines.lineEnd(n) });
      run = undefined;
    };
    for (let n = first; n <= last; n++) {
      const start = lines.starts[n - 1]!;
      const end = lines.lineEnd(n);
      if (end - start <= KNOWLEDGE_READ_MATCH_LINE_CHARS) {
        run ??= n;
        continue;
      }
      close(n - 1);
      const lower = text(n);
      const hits = needles.map(needle => lower.indexOf(needle)).filter(at => at !== -1);
      if (!hits.length) continue;
      const at = Math.min(...hits);
      const half = KNOWLEDGE_READ_MATCH_LINE_CHARS / 2;
      let cutStart = start + Math.max(0, at - half);
      let cutEnd = Math.min(end, start + at + half);
      if (isLowSurrogate(lines.body.charCodeAt(cutStart))) cutStart--;
      if (isLowSurrogate(lines.body.charCodeAt(cutEnd))) cutEnd++;
      parts.push({ start: cutStart, end: cutEnd });
    }
    close(last);
  }
  return parts;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}

/**
 * Most estimated tokens of one page chunk the semantic index embeds, page name and description
 * included. Well under common embedder limits (8,191 for OpenAI's), since the estimate can run low.
 */
export const KNOWLEDGE_EMBED_CHUNK_TOKENS = 2_000;
/** Estimated tokens each chunk repeats from the end of the one before it. */
export const KNOWLEDGE_EMBED_CHUNK_OVERLAP_TOKENS = 150;

/**
 * Splits `body` into pieces of at most `maxTokens` estimated tokens, breaking between paragraphs
 * and before headings (never inside fenced code unless one block alone is too big), each piece
 * starting with about `overlapTokens` from the end of the one before. A body that fits is one piece.
 */
export function knowledgeBodyChunks(
  body: string,
  maxTokens = KNOWLEDGE_EMBED_CHUNK_TOKENS,
  overlapTokens = KNOWLEDGE_EMBED_CHUNK_OVERLAP_TOKENS,
): string[] {
  if (estimateTokenCount(body) <= maxTokens) return [body];
  const room = maxTokens - overlapTokens;
  if (room < 1) throw new RangeError('knowledgeBodyChunks: maxTokens must be larger than overlapTokens.');

  // Paragraphs and fenced blocks, with a break before each heading.
  const blocks: Array<{ text: string; heading: boolean }> = [];
  let lines: string[] = [];
  let heading = false;
  let fence: string | undefined;
  const flush = () => {
    if (lines.some(line => line.trim())) blocks.push({ text: lines.join('\n'), heading });
    lines = [];
    heading = false;
  };
  for (const line of body.split('\n')) {
    const fenced = FENCE.test(line);
    if (fence === undefined && !fenced && !line.trim()) {
      flush();
      continue;
    }
    if (fence === undefined && !fenced && HEADING.test(line)) {
      flush();
      heading = true;
    }
    fence = nextFence(fence, line);
    lines.push(line);
  }
  flush();

  // A block too big for one chunk is cut by tokens.
  const pieces = blocks.flatMap(block => {
    if (estimateTokenCount(block.text) <= room) return [block];
    const cut: Array<{ text: string; heading: boolean }> = [];
    for (let rest = block.text, first = true; rest; first = false) {
      const piece = estimateTokenCount(rest) > room ? sliceByTokens(rest, 0, room) : rest;
      const size = piece.length || 1;
      cut.push({ text: rest.slice(0, size), heading: first && block.heading });
      rest = rest.slice(size);
    }
    return cut;
  });

  const chunks: string[] = [];
  let current: string[] = [];
  let tokens = 0;
  const close = () => {
    if (!current.length) return;
    const text = current.join('\n\n');
    chunks.push(text);
    const tail = overlapTokens > 0 ? sliceByTokens(text, -overlapTokens) : '';
    current = tail ? [tail] : [];
    tokens = estimateTokenCount(tail);
  };
  let fresh = true;
  for (const piece of pieces) {
    const size = estimateTokenCount(piece.text);
    // Start a new chunk when this one is full, or at a heading once it's half full.
    if (!fresh && (tokens + size > maxTokens || (piece.heading && tokens > maxTokens / 2))) {
      close();
      fresh = true;
    }
    current.push(piece.text);
    tokens += size;
    fresh = false;
  }
  if (!fresh) close();
  return chunks;
}

/** Longest a line runs in a heading skeleton before it is cut with `…`. */
const SKELETON_LINE_CHARS = 200;

/**
 * A long body seen whole at a glance: every heading with its line number, and under each as many
 * of its first lines as fit in `maxTokens`, shared out evenly; `⋯ lines a–b` marks what is left
 * out. Undefined when the headings alone don't fit.
 */
export function knowledgeBodySkeleton(
  lines: KnowledgeBodyLines,
  headingLines: number[],
  maxTokens: number,
): string | undefined {
  const width = String(lines.count).length;
  const text = (n: number) => lines.body.slice(lines.starts[n - 1]!, lines.lineEnd(n));
  const render = (n: number) => {
    const line = text(n);
    return `${String(n).padStart(width)}│${line.length > SKELETON_LINE_CHARS ? `${line.slice(0, SKELETON_LINE_CHARS)}…` : line}`;
  };
  const gap = (from: number, to: number) => `${' '.repeat(width)}⋯ lines ${from}–${to}`;
  const cost = (line: string) => estimateTokenCount(line) + 1;
  const starts = [...new Set([1, ...headingLines])].sort((a, b) => a - b);
  const sections = starts.map((start, i) => ({ start, end: (starts[i + 1] ?? lines.count + 1) - 1 }));
  const shown = new Set(headingLines);
  let tokens = 0;
  for (const n of shown) tokens += cost(render(n));
  // Every section may leave a gap marker behind it.
  tokens += sections.length * cost(gap(lines.count, lines.count));
  if (tokens > maxTokens) return undefined;
  const next = sections.map(section => section.start);
  for (let added = true; added;) {
    added = false;
    for (let i = 0; i < sections.length; i++) {
      let n = next[i]!;
      while (n <= sections[i]!.end && (shown.has(n) || !text(n).trim())) n++;
      if (n > sections[i]!.end) continue;
      const lineCost = cost(render(n));
      // Keep each preview to the section's first lines: once one does not fit, the section is done.
      next[i] = tokens + lineCost > maxTokens ? sections[i]!.end + 1 : n + 1;
      if (tokens + lineCost > maxTokens) continue;
      tokens += lineCost;
      shown.add(n);
      added = true;
    }
  }
  const out: string[] = [];
  let hidden: number | undefined;
  let hiddenText = false;
  const flush = (to: number) => {
    if (hidden !== undefined && hiddenText) out.push(gap(hidden, to));
    hidden = undefined;
    hiddenText = false;
  };
  for (let n = 1; n <= lines.count; n++) {
    if (shown.has(n)) {
      flush(n - 1);
      out.push(render(n));
    } else {
      hidden ??= n;
      hiddenText ||= Boolean(text(n).trim());
    }
  }
  flush(lines.count);
  return out.join('\n');
}
