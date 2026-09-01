import type { Container, Terminal, TUI } from '@earendil-works/pi-tui';
import { describe, expect, it, vi } from 'vitest';

import { FooterAnimationRenderer } from '../footer-animation-renderer.js';

function createHarness(initialFooterLines = ['old footer']) {
  const chatLines = Array.from({ length: 100 }, (_, index) => `chat ${index}`);
  let footerLines = initialFooterLines;
  const terminal = {
    columns: 80,
    rows: 24,
    write: vi.fn(),
  } as unknown as Terminal;
  const footer = {
    render: vi.fn(() => [...footerLines]),
  } as unknown as Container;
  const ui = {
    children: [{}, footer],
    previousLines: [] as string[],
    previousWidth: 80,
    previousHeight: 24,
    previousViewportTop: chatLines.length + footerLines.length - terminal.rows,
    renderRequested: false,
    renderTimer: undefined,
    stopped: false,
    hasOverlay: vi.fn(() => false),
    applyLineResets: vi.fn((lines: string[]) => lines.map(line => `${line}<reset>`)),
    render: vi.fn((_width: number) => [...chatLines, ...footerLines]),
  };
  const fullRender = ui.render;
  const renderer = new FooterAnimationRenderer(ui as unknown as TUI, terminal, footer);

  const completeFullRender = () => {
    const lines = ui.render(80);
    ui.previousLines = ui.applyLineResets([...lines]);
  };

  return {
    ui,
    terminal,
    renderer,
    fullRender,
    completeFullRender,
    setFooterLines(lines: string[]) {
      footerLines = lines;
    },
  };
}

describe('FooterAnimationRenderer', () => {
  it('redraws a stable visible footer without rendering the full tree', () => {
    const harness = createHarness();
    harness.completeFullRender();
    harness.setFooterLines(['new footer']);

    expect(harness.renderer.renderFrame()).toBe(true);

    expect(harness.fullRender).toHaveBeenCalledOnce();
    expect(harness.terminal.write).toHaveBeenCalledWith(
      '\x1b[?2026h\x1b7\x1b[24;1H\x1b[2Knew footer<reset>\x1b8\x1b[?2026l',
    );
    expect(harness.ui.previousLines.at(-1)).toBe('new footer<reset>');
  });

  it('redraws both rows of the real two-line footer without rendering the full tree', () => {
    const harness = createHarness(['old status', 'old memory']);
    harness.completeFullRender();
    harness.setFooterLines(['new status', 'new memory']);

    expect(harness.renderer.renderFrame()).toBe(true);

    expect(harness.fullRender).toHaveBeenCalledOnce();
    expect(harness.terminal.write).toHaveBeenCalledWith(
      '\x1b[?2026h\x1b7\x1b[23;1H\x1b[2Knew status<reset>\x1b[24;1H\x1b[2Knew memory<reset>\x1b8\x1b[?2026l',
    );
    expect(harness.ui.previousLines.slice(-2)).toEqual(['new status<reset>', 'new memory<reset>']);
  });

  it('redraws the current footer while a normal render is queued', () => {
    const harness = createHarness();
    harness.completeFullRender();
    harness.setFooterLines(['new footer']);
    harness.ui.renderRequested = true;
    const renderTimer = setTimeout(() => {}, 1_000);
    Object.assign(harness.ui, { renderTimer });

    expect(harness.renderer.renderFrame()).toBe(true);
    expect(harness.terminal.write).toHaveBeenCalledOnce();
    clearTimeout(renderTimer);
  });

  it('falls back when an overlay or footer geometry change invalidates the cached rows', () => {
    const harness = createHarness();
    harness.completeFullRender();
    harness.setFooterLines(['line one', 'line two']);

    expect(harness.renderer.renderFrame()).toBe(false);

    harness.setFooterLines(['new footer']);
    harness.ui.hasOverlay.mockReturnValue(true);
    expect(harness.renderer.renderFrame()).toBe(false);
    expect(harness.terminal.write).not.toHaveBeenCalled();
  });

  it('restores the wrapped full-tree renderer when disposed', () => {
    const harness = createHarness();
    const wrappedRender = harness.ui.render;

    harness.renderer.dispose();

    expect(harness.ui.render).not.toBe(wrappedRender);
    harness.ui.render(80);
    expect(harness.renderer.renderFrame()).toBe(false);
  });
});
