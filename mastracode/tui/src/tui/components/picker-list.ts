/**
 * Scrolling list body shared by hand-drawn pickers. The picker keeps its own
 * selection and key handling; this draws the visible window of items, each of
 * which may span several rows, plus the `(n/total)` scroll indicator.
 */

import { Text } from '@earendil-works/pi-tui';
import type { Component } from '@earendil-works/pi-tui';
import { theme } from '../theme.js';

export interface PickerListOptions<T> {
  maxVisible: number;
  /** Lines for one item; each line wraps to the list width like a `Text`. */
  renderItem: (item: T, selected: boolean, index: number) => string[];
  /** Shown when there are no items; omit to render nothing. */
  emptyText?: () => string;
  /** `Text` padding around each line, for pickers that draw rows as padded `Text`s. */
  paddingX?: number;
  paddingY?: number;
}

export class PickerList<T> implements Component {
  /** Text for the visible items, built when items are set (like the hand-drawn loops did). */
  private visibleLines: string[][] = [];
  private emptyLine: string | undefined;
  private selectedIndex = 0;
  private total = 0;
  private startIndex = 0;

  constructor(private readonly options: PickerListOptions<T>) {}

  setItems(items: T[], selectedIndex: number): void {
    const { maxVisible, renderItem, emptyText } = this.options;
    this.selectedIndex = selectedIndex;
    this.total = items.length;
    this.startIndex = Math.max(0, Math.min(selectedIndex - Math.floor(maxVisible / 2), items.length - maxVisible));
    const endIndex = Math.min(this.startIndex + maxVisible, items.length);
    this.visibleLines = [];
    for (let i = this.startIndex; i < endIndex; i++) {
      this.visibleLines.push(renderItem(items[i] as T, i === selectedIndex, i));
    }
    this.emptyLine = items.length === 0 ? emptyText?.() : undefined;
  }

  render(width: number): string[] {
    if (this.total === 0) {
      return this.emptyLine === undefined ? [] : new Text(theme.fg('muted', this.emptyLine), 0, 0).render(width);
    }

    const { paddingX = 0, paddingY = 0 } = this.options;
    const lines: string[] = [];
    for (const itemLines of this.visibleLines) {
      for (const line of itemLines) lines.push(...new Text(line, paddingX, paddingY).render(width));
    }
    if (this.startIndex > 0 || this.startIndex + this.visibleLines.length < this.total) {
      lines.push(...new Text(theme.fg('muted', `(${this.selectedIndex + 1}/${this.total})`), 0, 0).render(width));
    }
    return lines;
  }

  invalidate(): void {}
}
