/**
 * Decoder for SGR (mode 1006) mouse reports: `ESC [ < button ; col ; row M|m`.
 */

export type MouseEventKind =
  | 'press'
  | 'release'
  | 'drag'
  | 'move'
  | 'wheelUp'
  | 'wheelDown'
  | 'wheelLeft'
  | 'wheelRight';

export interface TerminalMouseEvent {
  kind: MouseEventKind;
  /** 0 = left, 1 = middle, 2 = right; undefined for wheel and button-less motion. */
  button?: number;
  /** 1-based screen column. */
  col: number;
  /** 1-based screen row. */
  row: number;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
}

const SGR_MOUSE_RE = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])$/;
const WHEEL_KINDS: MouseEventKind[] = ['wheelUp', 'wheelDown', 'wheelLeft', 'wheelRight'];

export function parseSgrMouse(data: string): TerminalMouseEvent | undefined {
  const match = SGR_MOUSE_RE.exec(data);
  if (!match) return undefined;
  const code = Number(match[1]);
  const col = Number(match[2]);
  const row = Number(match[3]);
  const released = match[4] === 'm';
  const modifiers = { shift: (code & 4) !== 0, alt: (code & 8) !== 0, ctrl: (code & 16) !== 0 };
  const buttonBits = code & 3;

  if (code & 64) {
    return { kind: WHEEL_KINDS[buttonBits]!, col, row, ...modifiers };
  }
  if (code & 32) {
    return buttonBits === 3
      ? { kind: 'move', col, row, ...modifiers }
      : { kind: 'drag', button: buttonBits, col, row, ...modifiers };
  }
  return { kind: released ? 'release' : 'press', button: buttonBits, col, row, ...modifiers };
}

/** True for any mouse report, including legacy X10 (`ESC [ M` + 3 bytes) reports we never request. */
export function isMouseReport(data: string): boolean {
  return SGR_MOUSE_RE.test(data) || (data.length === 6 && data.startsWith('\x1b[M'));
}

const CURSOR_POSITION_REPORT_RE = /^\x1b\[(\d+);(\d+)R$/;

/** Parses a cursor position report (reply to `ESC [ 6 n`) into 1-based row/column. */
export function parseCursorPositionReport(data: string): { row: number; col: number } | undefined {
  const match = CURSOR_POSITION_REPORT_RE.exec(data);
  return match ? { row: Number(match[1]), col: Number(match[2]) } : undefined;
}
