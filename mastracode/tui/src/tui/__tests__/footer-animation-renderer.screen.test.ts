import { Container, CURSOR_MARKER, TUI } from '@earendil-works/pi-tui';
import type { Component, Terminal } from '@earendil-works/pi-tui';
import xterm from '@xterm/headless';
import { describe, expect, it } from 'vitest';

import { FooterAnimationRenderer } from '../footer-animation-renderer.js';

const ROWS = 20;
const COLS = 40;

class Lines implements Component {
  constructor(public lines: string[]) {}
  render(): string[] {
    return this.lines;
  }
  invalidate(): void {}
}

/**
 * Drives the real pi-tui renderer and the footer fast path into a headless
 * terminal. `shellLines` simulates shell output above the cursor when
 * mastracode starts: pi-tui renders inline from there without clearing.
 */
async function renderAnimationFrame({ shellLines, chatLines }: { shellLines: number; chatLines: number }) {
  const screen = new xterm.Terminal({ cols: COLS, rows: ROWS, allowProposedApi: true });
  const pending: string[] = [];
  const flush = async () => {
    for (const data of pending.splice(0)) await new Promise<void>(resolve => screen.write(data, resolve));
  };
  const terminal = {
    start() {},
    stop() {},
    async drainInput() {},
    write: (data: string) => pending.push(data),
    columns: COLS,
    rows: ROWS,
    kittyProtocolActive: false,
    moveBy() {},
    hideCursor() {},
    showCursor() {},
    clearLine() {},
    clearFromCursor() {},
    clearScreen() {},
    setTitle() {},
    setProgress() {},
  } satisfies Terminal;

  for (let index = 0; index < shellLines; index += 1) pending.push(`$ shell ${index}\r\n`);
  await flush();

  const ui = new TUI(terminal);
  ui.addChild(new Lines(['» hi', ...Array.from({ length: chatLines }, (_, index) => `chat ${index}`)]));
  // Focused editor: the hardware cursor is parked inside it, not at the end of the content.
  ui.addChild(new Lines(['╭──────╮', `│ ›${CURSOR_MARKER}    │`, '╰──────╯']));
  const status = new Lines(['status old']);
  const footer = new Container();
  footer.addChild(status);
  ui.addChild(footer);

  const renderer = new FooterAnimationRenderer(ui, terminal, footer);
  (ui as unknown as { doRender(): void }).doRender();
  await flush();

  status.lines = ['status new'];
  const usedFastPath = renderer.renderFrame();
  await flush();

  const buffer = screen.buffer.active;
  const rows = Array.from({ length: ROWS }, (_, row) =>
    (buffer.getLine(buffer.viewportY + row)?.translateToString(true) ?? '').trimEnd(),
  );
  return { usedFastPath, rows: rows.slice(0, rows.findLastIndex(row => row !== '') + 1) };
}

describe('FooterAnimationRenderer on a real terminal', () => {
  it('animates the footer in place once content fills the terminal', async () => {
    const { usedFastPath, rows } = await renderAnimationFrame({ shellLines: 1, chatLines: 30 });

    expect(usedFastPath).toBe(true);
    expect(rows.slice(-4)).toEqual(['╭──────╮', '│ ›    │', '╰──────╯', 'status new']);
  });

  it('animates the footer in place when the TUI starts below the top row with short content', async () => {
    const { usedFastPath, rows } = await renderAnimationFrame({ shellLines: 1, chatLines: 0 });

    expect(usedFastPath).toBe(true);
    expect(rows).toEqual(['$ shell 0', '» hi', '╭──────╮', '│ ›    │', '╰──────╯', 'status new']);
  });
});
