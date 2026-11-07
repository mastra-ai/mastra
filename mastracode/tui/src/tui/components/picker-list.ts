/**
 * Scrolling list body shared by hand-drawn pickers. The picker keeps its own
 * selection and key handling; this draws the visible window and maps mouse
 * rows back to items, including items drawn across several rows.
 */

import { Text } from '@earendil-works/pi-tui';
import type { Component } from '@earendil-works/pi-tui';
import type { MouseAware, MousePoint, MouseTarget } from '../mouse/hit-test.js';
import { theme } from '../theme.js';

export interface PickerListOptions<T> {
  maxVisible: number;
  /** Lines for one item; each line wraps to the list width like a `Text`. */
  renderItem: (item: T, selected: boolean) => string[];
  /** Called with the clicked item's index. Pickers should do whatever Enter does. */
  onActivate: (index: number) => void;
  emptyText: () => string;
}

export class PickerList<T> implements Component, MouseAware {
  private items: T[] = [];
  private selectedIndex = 0;

  constructor(private readonly options: PickerListOptions<T>) {}

  setItems(items: T[], selectedIndex: number): void {
    this.items = items;
    this.selectedIndex = selectedIndex;
  }

  render(width: number): string[] {
    if (this.items.length === 0) return new Text(theme.fg('muted', this.options.emptyText()), 0, 0).render(width);

    const { startIndex, endIndex } = this.visibleRange();
    const lines: string[] = [];
    for (let i = startIndex; i < endIndex; i++) lines.push(...this.renderRows(i, width));
    if (startIndex > 0 || endIndex < this.items.length) {
      lines.push(
        ...new Text(theme.fg('muted', `(${this.selectedIndex + 1}/${this.items.length})`), 0, 0).render(width),
      );
    }
    return lines;
  }

  mouseTarget(point: MousePoint): MouseTarget | undefined {
    const { startIndex, endIndex } = this.visibleRange();
    let top = 0;
    for (let i = startIndex; i < endIndex; i++) {
      const height = this.renderRows(i, point.width).length;
      if (point.row < top + height) return { top, height, activate: () => this.options.onActivate(i) };
      top += height;
    }
    return undefined;
  }

  invalidate(): void {}

  private renderRows(index: number, width: number): string[] {
    const item = this.items[index] as T;
    return this.options
      .renderItem(item, index === this.selectedIndex)
      .flatMap(line => new Text(line, 0, 0).render(width));
  }

  private visibleRange(): { startIndex: number; endIndex: number } {
    const { maxVisible } = this.options;
    const startIndex = Math.max(
      0,
      Math.min(this.selectedIndex - Math.floor(maxVisible / 2), this.items.length - maxVisible),
    );
    return { startIndex, endIndex: Math.min(startIndex + maxVisible, this.items.length) };
  }
}
