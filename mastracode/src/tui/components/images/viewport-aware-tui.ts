/**
 * Thin TUI subclass that runs `imageManager.reconcileViewport(lines)`
 * after every frame's render pass.
 *
 * pi-tui's `doRender()` calls `this.render(width)` to get the flat
 * concatenated line array, then composites overlays and diffs against
 * the previous frame. We hook in *after* `render()` returns but
 * *before* overlay compositing, so the lines reflect each
 * InlineImageComponent's chosen state for this frame. The manager
 * scans for kitty image escapes (`i=<id>`) and updates each
 * registration's `inView` flag based on whether the escape sits inside
 * the terminal's bottom `rows` lines.
 *
 * The override is intentionally minimal — no other behavior change.
 */

import { TUI } from '@mariozechner/pi-tui';
import { imageManager } from './image-manager.js';

export class ViewportAwareTUI extends TUI {
  override render(width: number): string[] {
    const lines = super.render(width);
    imageManager.reconcileViewport(lines);
    return lines;
  }
}
