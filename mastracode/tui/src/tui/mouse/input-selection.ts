/**
 * Mouse-mode text selection in the input box: an anchor/head pair in editor
 * coordinates, plus helpers to read, remove and highlight the selected range.
 * Kept separate from cursor placement so selection can be dropped without
 * touching click-to-place-cursor.
 */
import { visibleWidth } from '@earendil-works/pi-tui';

export interface TextPosition {
  line: number;
  col: number;
}

export interface TextRange {
  start: TextPosition;
  end: TextPosition;
}

const REVERSE_ON = '\x1b[7m';
const REVERSE_OFF = '\x1b[27m';
const RESET = '\x1b[0m';
// CSI, APC (pi-tui's cursor marker) and OSC sequences, captured so split() keeps them.
const ESCAPE_RE = /(\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b_[^\x07]*\x07|\x1b\][^\x07]*\x07)/;
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function before(a: TextPosition, b: TextPosition): boolean {
  return a.line < b.line || (a.line === b.line && a.col < b.col);
}

export class InputSelection {
  private anchor: TextPosition | undefined;
  private head: TextPosition | undefined;

  start(position: TextPosition): void {
    this.anchor = position;
    this.head = position;
  }

  extend(position: TextPosition): void {
    if (this.anchor) this.head = position;
  }

  clear(): void {
    this.anchor = undefined;
    this.head = undefined;
  }

  /** The selected range in document order, or undefined when nothing is selected. */
  range(): TextRange | undefined {
    const { anchor, head } = this;
    if (!anchor || !head || (anchor.line === head.line && anchor.col === head.col)) return undefined;
    return before(anchor, head) ? { start: anchor, end: head } : { start: head, end: anchor };
  }
}

export function textInRange(lines: string[], range: TextRange): string {
  const { start, end } = range;
  if (start.line === end.line) return (lines[start.line] ?? '').slice(start.col, end.col);
  return [
    (lines[start.line] ?? '').slice(start.col),
    ...lines.slice(start.line + 1, end.line),
    (lines[end.line] ?? '').slice(0, end.col),
  ].join('\n');
}

/** Lines with the range removed; the cursor belongs at `range.start` afterwards. */
export function removeRange(lines: string[], range: TextRange): string[] {
  const { start, end } = range;
  const joined = (lines[start.line] ?? '').slice(0, start.col) + (lines[end.line] ?? '').slice(end.col);
  return [...lines.slice(0, start.line), joined, ...lines.slice(end.line + 1)];
}

/** Whether the range still fits the text (edits made outside mouse mode can invalidate it). */
export function rangeFits(lines: string[], range: TextRange): boolean {
  return [range.start, range.end].every(p => p.line < lines.length && p.col <= (lines[p.line] ?? '').length);
}

/**
 * Shows display columns [startCol, endCol) of a rendered line in reverse video,
 * keeping its existing styling. Resets inside the range (the editor's fake
 * cursor ends with one) re-open reverse video so the highlight doesn't break.
 */
export function highlightColumns(line: string, startCol: number, endCol: number): string {
  if (endCol <= startCol) return line;
  // Split by hand: pi-tui's sliceByColumn carries escapes seen before the slice into it, which
  // would duplicate the editor's cursor marker.
  const parts = ['', '', ''];
  let col = 0;
  const pieces = line.split(ESCAPE_RE);
  pieces.forEach((piece, i) => {
    if (i % 2 === 1) {
      parts[col < startCol ? 0 : col < endCol ? 1 : 2] += piece;
      return;
    }
    for (const { segment } of graphemes.segment(piece)) {
      parts[col < startCol ? 0 : col < endCol ? 1 : 2] += segment;
      col += visibleWidth(segment);
    }
  });
  const [head, middle, tail] = parts as [string, string, string];
  return head + REVERSE_ON + middle.replaceAll(RESET, RESET + REVERSE_ON) + REVERSE_OFF + tail;
}
