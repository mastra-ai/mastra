/**
 * Per-frame watcher that drives `imageManager.suppress() / .unsuppress()`
 * from pi-tui's overlay state.
 *
 * pi-tui doesn't expose a per-frame lifecycle hook, but every visible
 * component's `render()` is called once per frame. We slot one of these
 * into the UI tree as a zero-row child; its only job is to read
 * `ui.hasOverlay()` each frame and toggle the manager when the value
 * changes. Diffing the boolean inside `imageManager.suppress()` /
 * `unsuppress()` keeps the side effects (kitty-delete, force redraw)
 * scoped to actual edges.
 */

import type { Component, TUI } from '@mariozechner/pi-tui';
import { imageManager } from './image-manager.js';

export class OverlayWatcherComponent implements Component {
  private lastOverlayUp = false;

  constructor(private readonly ui: TUI) {}

  render(): string[] {
    const overlayUp = this.ui.hasOverlay();
    if (overlayUp !== this.lastOverlayUp) {
      this.lastOverlayUp = overlayUp;
      if (overlayUp) imageManager.suppress();
      else imageManager.unsuppress();
    }
    return [];
  }

  invalidate(): void {}
}
