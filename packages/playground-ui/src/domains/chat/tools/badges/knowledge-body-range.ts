import { isRecord } from '../../messages/signal-data';

interface Position {
  line: number;
  col?: number;
}
interface LineRange {
  start: Position;
  end: Position;
}

/** What part of a page a Knowledge call read or wrote: a short tag for the collapsed row, a sentence for the body. */
export interface BodyExtent {
  row: string | undefined;
  summary: string;
}

const isPosition = (value: unknown): value is Position => isRecord(value) && typeof value.line === 'number';
const isRange = (value: unknown): value is LineRange =>
  isRecord(value) && isPosition(value.start) && isPosition(value.end);

const at = ({ line, col }: Position) => (col === undefined ? `${line}` : `${line}:${col}`);

/** `lines 12–14`, `line 12`, or with columns `line 2:5–9`, `lines 5:200–9:40`. */
function linesText(range: LineRange): string {
  const { start, end } = range;
  const plural = start.line === end.line ? 'line' : 'lines';
  if (start.col === undefined && end.col === undefined) {
    return start.line === end.line ? `line ${start.line}` : `lines ${start.line}–${end.line}`;
  }
  if (start.line === end.line && end.col !== undefined) return `line ${at(start)}–${end.col}`;
  return `${plural} ${at(start)}–${at(end)}`;
}

const quoted = (terms: string[]) => terms.map(term => `"${term}"`).join(', ');

/**
 * Which part of the body a `knowledge_read` result holds, from the call's arguments and its page. A whole
 * body has no row tag; undefined when the result is not a body read at all (a notes-only read, a scope listing).
 */
export function readExtent(output: Record<string, unknown>, args: Record<string, unknown>): BodyExtent | undefined {
  const page = output.page;
  if (!isRecord(page)) return undefined;
  const count = typeof page.lineCount === 'number' ? page.lineCount : undefined;
  const of = count === undefined ? '' : ` of ${count}`;
  if (Array.isArray(page.matches)) {
    const terms = Array.isArray(args.match) ? args.match.filter((t): t is string => typeof t === 'string') : [];
    const context = typeof args.context === 'number' ? args.context : undefined;
    const ranges = page.matches
      .filter(isRecord)
      .map(match => match.range)
      .filter(isRange);
    if (!ranges.length) {
      return { row: `no matches ${quoted(terms)}`, summary: `No line contains ${quoted(terms)} (${count ?? 0} lines)` };
    }
    const capped =
      Array.isArray(output.more) &&
      output.more.some(note => typeof note === 'string' && note.startsWith('match: stopped'));
    const spans = ranges.map(range => linesText(range).replace(/^lines? /, '')).join(', ');
    return {
      row: `matches ${quoted(terms)}${context ? ` ±${context}` : ''}`,
      summary: `${capped ? 'First ' : ''}${ranges.length} match${ranges.length === 1 ? '' : 'es'} for ${quoted(terms)}${
        capped ? ', more follow' : ''
      }${context ? ` with ${context} lines of context` : ''}: lines ${spans}${of}`,
    };
  }
  if (isRange(page.range) && typeof page.lines === 'string') {
    const tag = `${linesText(page.range)}${of}`;
    const section = typeof args.section === 'string' && args.section ? `section "${args.section}", ` : '';
    const next = page.range.end.line + 1;
    const tail =
      count === undefined ? '' : page.range.end.line >= count ? ', end of page' : `, continues at line ${next}`;
    return { row: `${section}${tag}`, summary: `${tag[0]?.toUpperCase()}${tag.slice(1)}${tail}` };
  }
  if (typeof page.lines === 'string' && count !== undefined) {
    return {
      row: `overview of ${count} lines`,
      summary: `Overview: every heading and the first lines under it, of ${count} lines`,
    };
  }
  if (Array.isArray(page.outline))
    return { row: 'outline', summary: 'Outline: the page headings with their line numbers' };
  if (args.notes === true || args.mentionedIn === true) return undefined;
  if (typeof page.body !== 'string' || !page.body) return { row: 'empty page', summary: 'The page has no body' };
  return { row: undefined, summary: 'Whole page' };
}

/** Which lines a `knowledge_page` write replaced, from its `range` argument; undefined for a whole-body write. */
export function writeExtent(args: Record<string, unknown>): BodyExtent | undefined {
  if (!isRange(args.range)) return undefined;
  const text = linesText(args.range);
  const verb = typeof args.body === 'string' && args.body === '' ? 'Removed' : 'Replaced';
  return { row: text, summary: `${verb} ${text}` };
}
