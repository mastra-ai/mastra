/**
 * Fixed-height inline image; toggles between kitty/iTerm2 escape and a
 * "(image)" placeholder via `imageManager.isPlaceholder(self)`.
 *
 * Hand-rolled instead of `Text` because pi-tui's `visibleWidth` misparses
 * a cursor-up CSI immediately followed by a kitty APC and mangles the
 * payload into raw base64.
 *
 * Owners MUST call `dispose()` before discarding the instance, otherwise
 * the manager keeps a dead registration that ghosts on overlay toggles.
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

  /** Drop manager registration. Call before discarding the instance. */
  dispose(): void {
    imageManager.unregister(this);
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

  // Required by pi-tui Component. No cached state to invalidate: placeholder
  // lines are theme-stable and drawn lines are rebuilt every render().
  invalidate(): void {}
}
