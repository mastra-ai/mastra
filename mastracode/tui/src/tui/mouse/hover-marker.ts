import { sliceByColumn } from '@earendil-works/pi-tui';

import { theme } from '../theme.js';

const LEADING_ANSI_RE = /^(?:\x1b\[[0-9;]*m)*/;

/**
 * Marks rows as hovered by replacing their first column with an accent bar.
 * The row's leading styles (its background) are kept so the bar sits on the
 * same surface, and the rest of the row is untouched.
 */
export function markHoveredRows(lines: string[], top: number, height: number): string[] {
  if (height <= 0 || top >= lines.length || top + height <= 0) return lines;
  const marked = lines.slice();
  for (let row = Math.max(0, top); row < Math.min(lines.length, top + height); row += 1) {
    const line = marked[row]!;
    const leading = LEADING_ANSI_RE.exec(line)?.[0] ?? '';
    marked[row] = leading + theme.fg('accent', '▌') + leading + sliceByColumn(line, 1, Number.MAX_SAFE_INTEGER);
  }
  return marked;
}
