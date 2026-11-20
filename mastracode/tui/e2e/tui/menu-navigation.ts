import type { McE2eTerminal } from './types.js';

const ARROW_DOWN = '\x1b[B';
/** Settings and select lists mark the highlighted row with this cursor. */
// Overlays can be drawn over other rows, so only require indentation before
// the cursor and a label after it (which skips trailing "Manage →"). The
// indentation skips the prompt and sent messages, whose "→" sits in column 1.
const CURSOR_LINE = /\s{2,}→\s+\S/;

function highlightedRow(terminal: McE2eTerminal): string | undefined {
  return (
    terminal
      .serialize()
      .view.split('\n')
      .find(line => CURSOR_LINE.test(line))
      // An overlay row drawn over a shaded panel's edge keeps the edge glyphs on either side of it.
      ?.replace(/^[▄▀]+|[▄▀]+\s*$/g, '')
  );
}

async function waitForHighlightChange(
  terminal: McE2eTerminal,
  previous: string | undefined,
): Promise<string | undefined> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const current = highlightedRow(terminal);
    if (current !== undefined && current !== previous) return current;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  return highlightedRow(terminal);
}

/**
 * Move the highlight down to the first row matching `label` and press Enter.
 * Navigating by label keeps scenarios working when rows are added above.
 */
export async function selectMenuRow(terminal: McE2eTerminal, label: RegExp, maxRows = 40): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (!highlightedRow(terminal) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  const seen: string[] = [];
  let row = highlightedRow(terminal);
  for (let moved = 0; moved <= maxRows; moved++) {
    seen.push(row?.trim() ?? 'none');
    if (row && label.test(row)) {
      terminal.write('\r');
      return;
    }
    terminal.write(ARROW_DOWN);
    row = await waitForHighlightChange(terminal, row);
  }
  throw new Error(`No menu row matching ${label}; highlighted rows: ${[...new Set(seen)].join(' | ')}`);
}
