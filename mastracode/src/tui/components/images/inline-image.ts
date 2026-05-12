/**
 * Inline image component for tool result boxes.
 *
 * Always occupies a fixed row count so toggling between "drawn" (kitty/
 * iTerm2 escape on the last line) and "placeholder" (centered "(image)"
 * label) never shifts surrounding layout. The choice is made per frame
 * by `imageManager.isPlaceholder(self)`.
 *
 * Why a custom component instead of `Text`: pi-tui's `Text` wraps via
 * `visibleWidth`, which misparses `\x1b[NA` (cursor-up) immediately
 * followed by a kitty `\x1b_G` APC — the CSI scanner stops at `G` and
 * swallows the APC introducer. The line gets treated as thousands of
 * columns wide and sliced mid-payload, rendering as raw base64.
 */

import { visibleWidth } from '@mariozechner/pi-tui';
import type { Component } from '@mariozechner/pi-tui';
import { theme } from '../../theme.js';
import { imageManager } from './image-manager.js';
import type { ImageOwner } from './image-manager.js';

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
  private readonly emptyLines: string[];
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
    if (imageManager.isPlaceholder(this)) {
      return this.placeholderLines;
    }
    const last = this.borderPrefix + this.moveUp + this.sequence;
    const lines = this.emptyLines.slice(0, this.rows - 1);
    lines.push(last);
    return lines;
  }

  invalidate(): void {}
}
