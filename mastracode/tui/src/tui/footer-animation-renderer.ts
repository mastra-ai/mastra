import type { Component, Container, Terminal, TUI } from '@earendil-works/pi-tui';

import { requestRender } from './render-scheduler.js';
import type { TUIState } from './state.js';

// Mirrors private renderer state from the pinned pi-tui version. Revalidate
// direct footer rendering before upgrading @earendil-works/pi-tui.
interface PiTuiInternals {
  children: Component[];
  previousLines: string[];
  previousWidth: number;
  previousHeight: number;
  previousViewportTop: number;
  stopped: boolean;
  hasOverlay(): boolean;
  applyLineResets(lines: string[]): string[];
}

export class FooterAnimationRenderer {
  private readonly originalRender: TUI['render'];
  private previousFooterLines: string[] | undefined;
  private disposed = false;

  constructor(
    private readonly ui: TUI,
    private readonly terminal: Terminal,
    private readonly footer: Container,
  ) {
    this.originalRender = ui.render.bind(ui);
    ui.render = (width: number): string[] => {
      const lines = this.originalRender(width);
      this.previousFooterLines = this.renderFooter(width);
      return lines;
    };
  }

  renderFrame(): boolean {
    const ui = this.ui as unknown as PiTuiInternals;
    const width = this.terminal.columns;
    const height = this.terminal.rows;

    if (
      this.disposed ||
      ui.stopped ||
      ui.hasOverlay() ||
      ui.children.at(-1) !== this.footer ||
      ui.previousWidth !== width ||
      ui.previousHeight !== height ||
      !this.previousFooterLines?.length ||
      !ui.previousLines.length
    ) {
      return false;
    }

    const nextFooterLines = this.renderFooter(width);
    if (nextFooterLines.length !== this.previousFooterLines.length) {
      return false;
    }

    const firstFooterLine = ui.previousLines.length - this.previousFooterLines.length;
    if (
      firstFooterLine < ui.previousViewportTop ||
      firstFooterLine + nextFooterLines.length > ui.previousViewportTop + height ||
      !this.previousFooterLines.every((line, index) => ui.previousLines[firstFooterLine + index] === line)
    ) {
      return false;
    }

    const changedLines: Array<{ screenRow: number; line: string; index: number }> = [];
    for (let index = 0; index < nextFooterLines.length; index += 1) {
      const line = nextFooterLines[index]!;
      if (line === this.previousFooterLines[index]) continue;
      changedLines.push({
        screenRow: firstFooterLine + index - ui.previousViewportTop + 1,
        line,
        index,
      });
    }

    if (changedLines.length === 0) {
      this.previousFooterLines = nextFooterLines;
      return true;
    }

    let output = '\x1b[?2026h\x1b7';
    for (const { screenRow, line } of changedLines) {
      output += `\x1b[${screenRow};1H\x1b[2K${line}`;
    }
    output += '\x1b8\x1b[?2026l';
    this.terminal.write(output);

    for (const { index, line } of changedLines) {
      ui.previousLines[firstFooterLine + index] = line;
    }
    this.previousFooterLines = nextFooterLines;
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.ui.render = this.originalRender;
  }

  private renderFooter(width: number): string[] {
    const ui = this.ui as unknown as PiTuiInternals;
    return ui.applyLineResets([...this.footer.render(width)]);
  }
}

export function renderStatusAnimationFrame(state: TUIState, updateStatusLine: () => void): void {
  updateStatusLine();

  state.footerAnimationRenderer ??= new FooterAnimationRenderer(state.ui, state.terminal, state.footer);
  if (!state.footerAnimationRenderer.renderFrame()) {
    requestRender(state);
  }
}
