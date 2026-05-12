/**
 * Tracks live `InlineImageComponent`s so we can delete their kitty
 * placements when they go off-screen, when the display mode flips to
 * `'placeholder'` (overlay open), or when they unregister. Components
 * poll `isPlaceholder(self)` each frame; the manager never decides what
 * gets drawn. `reconcileViewport(lines)` runs post-render to flip
 * `inView` based on row position in the rendered output.
 */

import { deleteKittyImage } from '@mariozechner/pi-tui';
import type { TUI } from '@mariozechner/pi-tui';

/** Marker interface; components poll `isPlaceholder(self)` each frame. */
export type ImageOwner = object;

export type ImageDisplayMode = 'image' | 'placeholder';

interface Registration {
  owner: ImageOwner;
  kittyImageId?: number;
  /** True when the owner's pixels are within the terminal viewport. */
  inView: boolean;
}

class ImageManager {
  private ui: TUI | null = null;
  private registrations: Registration[] = [];
  private displayMode: ImageDisplayMode = 'image';

  attachTui(ui: TUI): void {
    this.ui = ui;
  }

  /** New images default to in-view; the next viewport reconcile may flip it. */
  register(owner: ImageOwner, kittyImageId?: number): void {
    this.registrations.push({ owner, kittyImageId, inView: true });
  }

  unregister(owner: ImageOwner): void {
    const i = this.registrations.findIndex(r => r.owner === owner);
    if (i === -1) return;
    const [reg] = this.registrations.splice(i, 1);
    if (reg) this.deletePlacement(reg);
  }

  isPlaceholder(owner: ImageOwner): boolean {
    if (this.displayMode === 'placeholder') return true;
    const reg = this.registrations.find(r => r.owner === owner);
    return !reg || !reg.inView;
  }

  /** Idempotent. Transitions delete every kitty placement and force a full redraw. */
  setDisplayMode(mode: ImageDisplayMode): void {
    if (mode === this.displayMode) return;
    this.displayMode = mode;
    if (mode === 'placeholder') {
      for (const reg of this.registrations) this.deletePlacement(reg);
    }
    this.forceFullRedraw();
  }

  /**
   * Post-render: scan `lines` for kitty image escapes, derive each
   * registration's row position, and update `inView`. Owners that just
   * left the viewport get their kitty placement deleted so the layer
   * doesn't ghost into the visible area.
   */
  reconcileViewport(lines: string[]): void {
    if (this.registrations.length === 0 || !this.ui) return;
    if (this.displayMode === 'placeholder') return;

    const termRows = this.ui.terminal.rows;
    const totalLines = lines.length;
    const viewportTop = Math.max(0, totalLines - termRows);

    // Find every kitty image escape in render output, indexed by kitty id.
    const foundRowsById = new Map<number, number>();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.indexOf('\x1b_G') === -1) continue;
      // Kitty's `i=<digits>` parameter only appears on the first chunk;
      // chunked images put `m=1` on subsequent chunks. We only need the
      // first occurrence per id, but multiple kitty escapes can appear on
      // one line (rare). Scan with a global regex.
      const re = /\x1b_G[^;]*?\bi=(\d+)/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        const id = Number(m[1]);
        if (!foundRowsById.has(id)) foundRowsById.set(id, i);
      }
    }

    for (const reg of this.registrations) {
      // iTerm2 owners have no kitty id; fall back to leaving them in view.
      // (iTerm2 doesn't accumulate placements the way kitty does, so the
      // off-view demotion logic is a kitty concern.)
      if (reg.kittyImageId === undefined) {
        reg.inView = true;
        continue;
      }
      const row = foundRowsById.get(reg.kittyImageId);
      // Owner currently rendering as placeholder will have no escape in
      // `lines`. Keep its inView flag where it was — placeholders that
      // scrolled off stay off; if it's still in placeholder mode for some
      // other reason we don't promote here (one-frame lag, acceptable).
      if (row === undefined) continue;
      const wasInView = reg.inView;
      const nowInView = row >= viewportTop;
      reg.inView = nowInView;
      if (wasInView && !nowInView) {
        this.deletePlacement(reg);
      }
    }
  }

  /** Force pi-tui to fully repaint the viewport on the next frame. */
  private forceFullRedraw(): void {
    if (!this.ui) return;
    try {
      // Reset pi-tui's diff snapshot so the next render writes every
      // line, overwriting any popup glyphs composited last frame. These
      // fields are declared private; reach in via an untyped alias.
      const tuiInternals = this.ui as unknown as {
        previousLines: string[];
        previousWidth: number;
        previousHeight: number;
      };
      tuiInternals.previousLines = [];
      tuiInternals.previousWidth = 0;
      tuiInternals.previousHeight = 0;
      // Clear the visible viewport. Intentionally NOT `\x1b[3J` — that
      // would erase the user's scrollback on every overlay toggle.
      this.ui.terminal.write('\x1b[2J\x1b[H');
      this.ui.requestRender();
    } catch {
      // best-effort
    }
  }

  private deletePlacement(reg: Registration): void {
    if (!reg.kittyImageId || !this.ui) return;
    try {
      this.ui.terminal.write(deleteKittyImage(reg.kittyImageId));
    } catch {
      // best-effort cleanup
    }
  }
}

/** Process-wide singleton; the TUI is a singleton too. */
export const imageManager = new ImageManager();
