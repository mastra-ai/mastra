/**
 * Shared ANSI text-handling helpers for TUI components.
 */

import { visibleWidth } from '@earendil-works/pi-tui';

const ANSI_CLOSERS = '\x1b]8;;\x07\x1b[0m';
const ELLIPSIS = '…';
const ELLIPSIS_WIDTH = visibleWidth(ELLIPSIS);

function fitVisibleText(text: string, maxWidth: number): { text: string; width: number; truncated: boolean } {
  if (maxWidth <= 0) return { text: '', width: 0, truncated: text.length > 0 };

  const targetWidth = Math.max(0, maxWidth - ELLIPSIS_WIDTH);
  let width = 0;
  let result = '';
  let resultWidth = 0;

  for (const char of text) {
    const charWidth = visibleWidth(char);
    if (width + charWidth > maxWidth) {
      return { text: `${result}${ELLIPSIS}`, width: resultWidth + ELLIPSIS_WIDTH, truncated: true };
    }
    if (width + charWidth <= targetWidth) {
      result += char;
      resultWidth += charWidth;
    }
    width += charWidth;
  }

  return { text, width, truncated: false };
}

/** Truncate a string with ANSI codes to a visible width.
 *  Handles both SGR sequences (\x1b[...m) and OSC 8 hyperlinks (\x1b]8;...;\x07).
 */
export function truncateAnsi(str: string, maxWidth: number): string {
  if (maxWidth <= 0) return '';

  // The OSC 8 hyperlink body is terminated by BEL (\x07). We also
  // break on a new ESC (\x1b) so a missing terminator cannot scan
  // unbounded input and amplify polynomial backtracking.
  const ansiRegex = /\x1b\[[0-9;]{0,32}m|\x1b\]8;[^\x07\x1b]{0,8192}\x07/g;
  let visibleLength = 0;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ansiRegex.exec(str)) !== null) {
    // Add text before this ANSI code
    const textBefore = str.slice(lastIndex, match.index);
    const fitted = fitVisibleText(textBefore, maxWidth - visibleLength);
    if (fitted.truncated) {
      result += fitted.text;
      result += ANSI_CLOSERS; // Close any open hyperlink + reset styles
      return result;
    }
    result += fitted.text;
    visibleLength += fitted.width;

    // Add the ANSI code (doesn't count toward visible length)
    result += match[0];
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last ANSI code
  const remaining = str.slice(lastIndex);
  const fitted = fitVisibleText(remaining, maxWidth - visibleLength);
  result += fitted.text;
  if (fitted.truncated) result += ANSI_CLOSERS; // Close hyperlink + reset

  return result;
}
