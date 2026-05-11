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
 * Only ever keep ONE active inline image at a time, but never change the
 * row count of any image component:
 *
 *   - Each `InlineImageComponent` registers with the manager on
 *     construction. A new registration becomes active and the previous
 *     placement is deleted from the terminal.
 *   - Components query `isActive(self)` and `imageSuppressedByOverlay()`
 *     each frame and pick between drawing the kitty/iTerm2 escape or
 *     showing a fixed-size "(image)" placeholder that uses the same row
 *     count. Toggling never reflows the chat.
 *   - When an overlay opens we proactively delete the placement so its
 *     graphics layer doesn't bleed through the popup. When it closes the
 *     line-stream emits the kitty escape again and the diff renderer
 *     re-places the image.
 *
 * The manager owns no rendering of its own; it just answers two questions
 * for components every frame:
 *
 *   - `isActive(component)`        — should I draw the image bytes?
 *   - `imageSuppressedByOverlay()` — is there an overlay covering me?
 */

import { deleteKittyImage } from '@mariozechner/pi-tui';
import type { TUI } from '@mariozechner/pi-tui';

/**
 * Marker interface for components the manager tracks. The manager doesn't
 * call back into owners — components poll `isActive` / `imageSuppressedByOverlay`
 * each frame.
 */
export type ImageOwner = object;

interface Registration {
  owner: ImageOwner;
  kittyImageId?: number;
}

class ImageManager {
  private ui: TUI | null = null;
  private active: Registration | null = null;
  /** Tracks last-seen overlay state so we can act on transitions. */
  private overlayActive = false;

  attachTui(ui: TUI): void {
    this.ui = ui;
  }

  /**
   * Register a new image as the active inline image. Any previously-active
   * placement is deleted from the terminal. The previous component keeps
   * rendering (at the same row count) but will now see
   * `isActive(self) === false` and switch to its placeholder presentation
   * on its next render.
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

  isActive(owner: ImageOwner): boolean {
    return this.active?.owner === owner;
  }

  /**
   * True when the active image's terminal placement must be hidden right
   * now (because an overlay is on screen). Components consult this every
   * frame from `render()`.
   *
   * Also detects overlay open/close transitions and issues a kitty delete
   * the moment an overlay appears so the prior placement doesn't bleed
   * through the popup background.
   */
  imageSuppressedByOverlay(): boolean {
    if (!this.ui) return false;
    const overlayUp = this.ui.hasOverlay();
    if (overlayUp !== this.overlayActive) {
      this.overlayActive = overlayUp;
      if (overlayUp) {
        // Overlay just opened: erase the placement so popup cells are
        // genuinely empty. The next no-overlay frame will re-emit the
        // kitty sequence (different line vs previousLines) and the
        // diff renderer re-places it.
        if (this.active) this.deletePlacement(this.active);
      } else {
        // Overlay just closed: force a render so the image's line is
        // re-emitted promptly.
        this.ui.requestRender();
      }
    }
    return overlayUp;
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
