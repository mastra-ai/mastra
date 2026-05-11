/**
 * Inline image component for tool result boxes.
 *
 * Two visual states, fixed row count
 * ----------------------------------
 * The component always occupies the SAME number of terminal rows. Each
 * frame it picks one of two presentations for those rows:
 *
 *   1. "drawn"      — (rows-1) empty bordered lines plus a final line
 *                     containing cursor-up + the kitty/iTerm2 escape, so
 *                     the image is actually rendered.
 *   2. "placeholder" — every row is empty/bordered except for a single
 *                     centered "(image)" label, used when the image
 *                     should not be drawn right now.
 *
 * Because the row count never changes the input box, prompts, etc. never
 * shift when we toggle between states.
 *
 * "Placeholder" is chosen whenever one of these is true:
 *   - this is not the most recent inline image (a newer screenshot has
 *     taken over as "active"); we do not stack kitty placements.
 *   - an overlay is currently visible; pi-tui's compositor cannot paint
 *     over image-bearing lines, so we hide ours and `imageManager` also
 *     writes a delete-by-id to clear the graphics layer underneath the
 *     overlay. When the overlay closes the next render re-emits the
 *     escape and the diff renderer re-places it.
 *
 * Why a custom component (not Text)
 * ---------------------------------
 * pi-tui's Text wraps via `visibleWidth`, and `visibleWidth` misparses
 * `\x1b[NA` (cursor-up) when it is immediately followed by a kitty
 * `\x1b_G` APC start — the CSI scanner stops at `G` and swallows the APC
 * introducer. The line would then be treated as thousands of columns
 * wide and sliced mid-payload, rendering as raw base64.
 */

import { visibleWidth } from '@mariozechner/pi-tui';
import type { Component } from '@mariozechner/pi-tui';
import { theme } from '../../theme.js';
import { imageManager, type ImageOwner } from './image-manager.js';

export interface InlineImageArgs {
  /** Total terminal rows this component reserves. Stable across frames. */
  rows: number;
  /** Border-only prefix used on every line ("│ " with theme color). */
  borderPrefix: string;
  /** Full kitty/iterm2 escape (already chunked). */
  sequence: string;
  /** Cursor-up escape applied on the final line so the image draws at row 0. */
  moveUp: string;
  /** Width in cells the parent box has reserved for content. */
  contentWidth: number;
  /** Kitty image id (omitted for iTerm2). */
  kittyImageId?: number;
}

export class InlineImageComponent implements Component, ImageOwner {
  private readonly rows: number;
  private readonly borderPrefix: string;
  private readonly sequence: string;
  private readonly moveUp: string;
  private readonly kittyImageId?: number;
  /** Cached "empty bordered" lines reused while suppressed. */
  private readonly emptyLines: string[];
  /** Pre-rendered "(image)" placeholder lines (same row count as `rows`). */
  private readonly placeholderLines: string[];

  constructor(args: InlineImageArgs) {
    this.rows = args.rows;
    this.borderPrefix = args.borderPrefix;
    this.sequence = args.sequence;
    this.moveUp = args.moveUp;
    this.kittyImageId = args.kittyImageId;

    this.emptyLines = [];
    for (let i = 0; i < this.rows; i++) this.emptyLines.push(this.borderPrefix);

    // Vertically + horizontally centered "(image)" inside the reserved rows.
    const label = theme.fg('muted', '(image)');
    const labelVisibleWidth = visibleWidth(label);
    const leftPad = Math.max(0, Math.floor((args.contentWidth - labelVisibleWidth) / 2));
    const middleRow = Math.floor((this.rows - 1) / 2);
    this.placeholderLines = this.emptyLines.map((empty, i) =>
      i === middleRow ? this.borderPrefix + ' '.repeat(leftPad) + label : empty,
    );

    imageManager.register(this, this.kittyImageId);
  }

  render(): string[] {
    const showImage = imageManager.isActive(this) && !imageManager.imageSuppressedByOverlay();
    if (!showImage) {
      return this.placeholderLines;
    }
    const last = this.borderPrefix + this.moveUp + this.sequence;
    const lines = this.emptyLines.slice(0, this.rows - 1);
    lines.push(last);
    return lines;
  }

  invalidate(): void {}
}
