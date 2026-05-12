import { describe, expect, it, beforeEach } from 'vitest';
import { imageManager } from '../image-manager.js';

// Minimal fake TUI surface that satisfies what the manager touches.
function makeFakeTui(termRows = 40): {
  terminal: { rows: number; columns: number; write: (s: string) => void; writes: string[] };
  hasOverlay: () => boolean;
  requestRender: () => void;
  previousLines: string[];
  previousWidth: number;
  previousHeight: number;
} {
  const writes: string[] = [];
  return {
    terminal: {
      rows: termRows,
      columns: 100,
      write: (s: string) => writes.push(s),
      writes,
    },
    hasOverlay: () => false,
    requestRender: () => {},
    previousLines: ['something'],
    previousWidth: 1,
    previousHeight: 1,
  };
}

// Build a fake kitty-image-bearing line for image id `n`.
const kittyLine = (n: number) => `\x1b_Ga=T,f=100,q=2,c=20,r=8,i=${n};AAAA\x1b\\`;

describe('imageManager.reconcileViewport', () => {
  beforeEach(() => {
    // Reset singleton state between tests.
    // Drop any leftover registrations from prior tests.
    while (true) {
      const before = (imageManager as unknown as { registrations: unknown[] }).registrations.length;
      if (before === 0) break;
      const reg = (imageManager as unknown as { registrations: Array<{ owner: object }> }).registrations[0];
      if (!reg) break;
      imageManager.unregister(reg.owner);
    }
    // Force display mode back to image
    imageManager.setDisplayMode('image');
  });

  it('marks an image in-view when it sits inside the bottom termRows lines', () => {
    const tui = makeFakeTui(10);
    imageManager.attachTui(tui as never);

    const owner = {};
    imageManager.register(owner, 42);

    // 12 total lines, terminal rows = 10 → viewportTop = 2.
    // Image escape on line 5 → in view (5 >= 2).
    const lines: string[] = Array(12).fill('plain');
    lines[5] = kittyLine(42);

    imageManager.reconcileViewport(lines);

    expect(imageManager.isPlaceholder(owner)).toBe(false);
  });

  it('marks an image as placeholder when it scrolls above the viewport', () => {
    const tui = makeFakeTui(10);
    imageManager.attachTui(tui as never);

    const owner = {};
    imageManager.register(owner, 99);

    // 30 total lines, terminal rows = 10 → viewportTop = 20.
    // Image escape on line 5 → off view (5 < 20).
    const lines: string[] = Array(30).fill('plain');
    lines[5] = kittyLine(99);

    imageManager.reconcileViewport(lines);

    expect(imageManager.isPlaceholder(owner)).toBe(true);
    // Owner that just transitioned off-view should have its kitty placement deleted.
    expect(tui.terminal.writes.some(w => w.includes('a=d') && w.includes('i=99'))).toBe(true);
  });

  it('supports multiple simultaneous in-view images', () => {
    const tui = makeFakeTui(20);
    imageManager.attachTui(tui as never);

    const a = {};
    const b = {};
    imageManager.register(a, 100);
    imageManager.register(b, 101);

    // 15 total lines, both image escapes within the viewport.
    const lines: string[] = Array(15).fill('plain');
    lines[3] = kittyLine(100);
    lines[10] = kittyLine(101);

    imageManager.reconcileViewport(lines);

    expect(imageManager.isPlaceholder(a)).toBe(false);
    expect(imageManager.isPlaceholder(b)).toBe(false);
  });

  it('demotes the older image when a new one pushes it past the viewport top', () => {
    const tui = makeFakeTui(10);
    imageManager.attachTui(tui as never);

    const older = {};
    const newer = {};
    imageManager.register(older, 200);
    imageManager.register(newer, 201);

    // Older image at row 5, newer at row 25, terminal rows = 10 → viewportTop = 16.
    const lines: string[] = Array(26).fill('plain');
    lines[5] = kittyLine(200);
    lines[25] = kittyLine(201);

    imageManager.reconcileViewport(lines);

    expect(imageManager.isPlaceholder(older)).toBe(true);
    expect(imageManager.isPlaceholder(newer)).toBe(false);
  });
});
