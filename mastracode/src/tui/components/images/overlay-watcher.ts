/**
 * Per-frame watcher that drives `imageManager.setDisplayMode(...)` from
 * pi-tui's overlay state.
 *
 * pi-tui doesn't expose a per-frame lifecycle hook, but every visible
 * component's `render()` is called once per frame. We slot one of these
 * into the UI tree as a zero-row child; its only job is to read
 * `ui.hasOverlay()` each frame and forward it to the manager.
 * `setDisplayMode` is idempotent — only an actual transition runs the
 * side effects (kitty-delete, force redraw).
 */

import type { Component, TUI } from '@mariozechner/pi-tui';
import { imageManager } from './image-manager.js';

export class OverlayWatcherComponent implements Component {
  constructor(private readonly ui: TUI) {}

  render(): string[] {
    imageManager.setDisplayMode(this.ui.hasOverlay() ? 'placeholder' : 'image');
    return [];
  }

  invalidate(): void {}
}
