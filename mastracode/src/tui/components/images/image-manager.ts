/**
 * Coordinates inline image rendering for the TUI.
 *
 * Background
 * ----------
 * Terminal images (Kitty/iTerm2) are placed as graphics layers that persist
 * at the cells where they were drawn. They don't participate in pi-tui's
 * differential line-diff rendering: the image data sits on its own graphics
 * z-layer and stays put even when surrounding text changes.
 *
 * That creates two visible bugs:
 *
 * 1. Overlay bleed-through. pi-tui's `compositeLineAt` short-circuits on
 *    image-bearing lines (`isImageLine === true`), so popup overlays can't
 *    paint over the image's cell range. The popup *can* paint over the
 *    empty bordered lines reserved above the image, and when the popup
 *    closes those overlay cells aren't always cleanly repainted -> ghost
 *    popup-bg/text bands remain.
 *
 * 2. Accumulating placements. Every screenshot we render leaves a kitty
 *    image resident in the terminal. Older placements scroll up but stay
 *    drawn at their original viewport row until the terminal is cleared.
 *
 * Strategy
 * --------
 * Keep at most one active inline image, with two orthogonal reasons to
 * fall back to a placeholder presentation that occupies the same rows:
 *
 *   - The image is no longer the active one (a newer image registered).
 *   - Display mode is currently `'placeholder'` — set by external callers
 *     when a popup is open, or any other future reason to hide the image.
 *
 * Components ask `isPlaceholder(self)` each frame; it's a pure read of
 * those two pieces of state. The manager doesn't know what an overlay is.
 *
 * External callers drive the display mode via `setDisplayMode('image' |
 * 'placeholder')`. That setter is where the side effects live: deleting
 * the kitty placement so a popup isn't punched through, and forcing a
 * full pi-tui redraw so popup glyphs don't ghost on image-bearing rows.
 * Today the only caller is the overlay watcher in `state.ts`, but the
 * seam is shape-correct for adding other "hide the image" reasons later
 * (image scrolled off-screen, user-toggled, etc.) without touching the
 * manager.
 */

import { deleteKittyImage } from '@mariozechner/pi-tui';
import type { TUI } from '@mariozechner/pi-tui';

/**
 * Marker interface for components the manager tracks. The manager doesn't
 * call back into owners — components poll `isPlaceholder` each frame.
 */
export type ImageOwner = object;

export type ImageDisplayMode = 'image' | 'placeholder';

interface Registration {
  owner: ImageOwner;
  kittyImageId?: number;
}

class ImageManager {
  private ui: TUI | null = null;
  private active: Registration | null = null;
  /** External setting driven via `setDisplayMode()`. */
  private displayMode: ImageDisplayMode = 'image';

  attachTui(ui: TUI): void {
    this.ui = ui;
  }

  /**
   * Register a new image as the active inline image. Any previously-active
   * placement is deleted from the terminal. The previous component keeps
   * rendering (at the same row count) but will now see
   * `isPlaceholder(self) === true` and switch to its placeholder
   * presentation on its next render.
   */
  register(owner: ImageOwner, kittyImageId?: number): void {
    if (this.active && this.active.owner !== owner) {
      this.deletePlacement(this.active);
    }
    this.active = { owner, kittyImageId };
  }

  /** Drop a registration without promoting another image. */
  unregister(owner: ImageOwner): void {
    if (this.active?.owner === owner) {
      this.deletePlacement(this.active);
      this.active = null;
    }
  }

  /**
   * Pure predicate. Returns true when the component should render its
   * muted "(image)" placeholder instead of the kitty/iTerm2 escape —
   * either because it isn't the active image, or because the manager
   * is currently in `'placeholder'` display mode.
   */
  isPlaceholder(owner: ImageOwner): boolean {
    return this.displayMode === 'placeholder' || this.active?.owner !== owner;
  }

  /**
   * Set the manager's display mode. Idempotent.
   *
   * Switching to `'placeholder'` deletes the active kitty placement so
   * it doesn't bleed through whatever's covering the image, and forces
   * a full pi-tui redraw so the graphics layer is wiped. Switching back
   * to `'image'` forces a full redraw so the next frame re-emits the
   * kitty escape and any leftover glyphs from whatever was covering
   * the image are repainted.
   */
  setDisplayMode(mode: ImageDisplayMode): void {
    if (mode === this.displayMode) return;
    this.displayMode = mode;
    if (mode === 'placeholder' && this.active) this.deletePlacement(this.active);
    this.forceFullRedraw();
  }

  /**
   * Force pi-tui to repaint the entire viewport on the next frame.
   *
   * We clear pi-tui's `previousLines` cache so its differential renderer
   * sees a "first render" and rewrites every row, and we send a
   * clear-screen escape so any popup glyphs composited onto rows the
   * diff renderer thinks haven't changed are physically wiped.
   *
   * This avoids the class of bugs where overlay-composited rows (or
   * shrink-path edge cases at the bottom of the viewport) leave ghost
   * popup text or backgrounds after an overlay closes.
   */
  private forceFullRedraw(): void {
    if (!this.ui) return;
    try {
      // Reset the differential renderer's prior-frame snapshot. On the
      // next render pi-tui treats it as a first render and writes every
      // line, so any popup glyphs composited last frame are overwritten
      // even on rows the diff would otherwise consider unchanged.
      // pi-tui's snapshot fields are declared private; reach in
      // intentionally via an untyped alias.
      const tuiInternals = this.ui as unknown as {
        previousLines: string[];
        previousWidth: number;
        previousHeight: number;
      };
      tuiInternals.previousLines = [];
      tuiInternals.previousWidth = 0;
      tuiInternals.previousHeight = 0;
      // Clear the visible viewport so leftover popup backgrounds painted
      // last frame are wiped from the terminal. We intentionally do NOT
      // send `\x1b[3J` (erase scrollback) — that would destroy the user's
      // terminal history every time an overlay opens or closes.
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
