/**
 * Coordinates inline image rendering for the TUI.
 *
 * Background
 * ----------
 * Terminal images (Kitty/iTerm2) are placed as graphics layers that persist
 * at the cells where they were drawn. They do not participate in pi-tui's
 * differential line-diff rendering: the image data sits on its own graphics
 * z-layer and stays put even when surrounding text changes.
 *
 * That creates two visible bugs:
 *
 * 1. Overlay bleed-through. pi-tui's `compositeLineAt` short-circuits on
 *    image-bearing lines (`isImageLine === true`), so popup overlays cannot
 *    paint over the image's cell range. Worse, the popup *can* paint over
 *    the (rows-1) empty bordered lines reserved above the image, and when
 *    the popup closes those overlay cells aren't always cleanly repainted
 *    -> ghost popup-bg/text bands remain.
 *
 * 2. Accumulating placements. Every screenshot we render leaves a kitty
 *    image resident in the terminal. Older placements scroll up but stay
 *    drawn at their original viewport row until the terminal is cleared.
 *
 * Strategy
 * --------
 * Only ever keep ONE active inline image at a time:
 *
 *   - Each `RawImageComponent` registers with the manager on construction.
 *   - Registering a new image deletes the previous one (kitty `a=d,i=...`).
 *   - Demoted images render as a compact text fallback (their reserved
 *     rows shrink to one bordered line) so old screenshots become
 *     `[Image: image/png 1280x720]` placeholders.
 *   - While any overlay is visible, the active image is suppressed:
 *     - its `render()` returns empty bordered lines (no kitty escape),
 *     - and we write a delete sequence directly to the terminal so the
 *       graphics layer is cleared underneath the overlay.
 *   - When the overlay closes, the next render produces the kitty escape
 *     again and pi-tui's diff renderer re-emits it (different line content
 *     -> repainted -> image is re-placed).
 *
 * The manager owns no rendering of its own; it just maintains state and
 * answers two questions for components every frame:
 *
 *   - `isActive(component)`        — should I render the image bytes?
 *   - `imageSuppressedByOverlay()` — is there an overlay covering me?
 */

import { deleteKittyImage } from '@mariozechner/pi-tui';
import type { TUI } from '@mariozechner/pi-tui';

export interface ImageOwner {
  /** Called when this image is superseded; component should rebuild as text fallback. */
  onDemoted(): void;
}

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
   * image is demoted (kitty placement deleted; owner notified to re-render
   * itself as a text fallback).
   *
   * Returns true when the caller is the active image.
   */
  register(owner: ImageOwner, kittyImageId?: number): boolean {
    if (this.active && this.active.owner !== owner) {
      this.deletePlacement(this.active);
      const prev = this.active.owner;
      this.active = null;
      // Notify after clearing so the demoted component's rebuild sees
      // `isActive(self) === false`.
      try {
        prev.onDemoted();
      } catch {
        // owner errors must not break the new registration
      }
    }
    this.active = { owner, kittyImageId };
    return true;
  }

  /**
   * Drop a registration without promoting another image. Used when a tool
   * component is being removed (e.g. chat cleared) or its result changes
   * to something that no longer has an image part.
   */
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
