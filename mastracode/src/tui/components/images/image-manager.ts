/**
 * Coordinates inline image rendering for the TUI.
 *
 * Kitty/iTerm2 images sit on a graphics z-layer outside pi-tui's diff
 * renderer, so they persist across redraws and pi-tui's `compositeLineAt`
 * short-circuits on image-bearing lines — popups can't paint over them.
 *
 * Manager keeps at most one active image. Components render a placeholder
 * (same row count) when either: they aren't the active image, or display
 * mode has been switched to `'placeholder'` externally (e.g. an overlay
 * opened). Mode transitions delete the kitty placement and force a full
 * pi-tui redraw so popup glyphs don't ghost.
 */

import { deleteKittyImage } from '@mariozechner/pi-tui';
import type { TUI } from '@mariozechner/pi-tui';

/** Marker interface; components poll `isPlaceholder(self)` each frame. */
export type ImageOwner = object;

export type ImageDisplayMode = 'image' | 'placeholder';

interface Registration {
  owner: ImageOwner;
  kittyImageId?: number;
}

class ImageManager {
  private ui: TUI | null = null;
  private active: Registration | null = null;
  private displayMode: ImageDisplayMode = 'image';

  attachTui(ui: TUI): void {
    this.ui = ui;
  }

  /** Make `owner` the active image, deleting any previous placement. */
  register(owner: ImageOwner, kittyImageId?: number): void {
    if (this.active && this.active.owner !== owner) {
      this.deletePlacement(this.active);
    }
    this.active = { owner, kittyImageId };
  }

  unregister(owner: ImageOwner): void {
    if (this.active?.owner === owner) {
      this.deletePlacement(this.active);
      this.active = null;
    }
  }

  isPlaceholder(owner: ImageOwner): boolean {
    return this.displayMode === 'placeholder' || this.active?.owner !== owner;
  }

  /** Idempotent. Transitions delete the placement and force a full redraw. */
  setDisplayMode(mode: ImageDisplayMode): void {
    if (mode === this.displayMode) return;
    this.displayMode = mode;
    if (mode === 'placeholder' && this.active) this.deletePlacement(this.active);
    this.forceFullRedraw();
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
