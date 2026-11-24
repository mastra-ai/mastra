/**
 * Scrolling list body shared by menus that draw their own rows (threads, models, GitHub PRs). The menu
 * keeps its own selection and key handling; this draws the visible window of items, each of which may
 * span several rows, plus the `(n/total)` scroll indicator, and maps mouse rows back to the item drawn there.
 */

import { Text, TruncatedText } from '@earendil-works/pi-tui';
import type { Component } from '@earendil-works/pi-tui';
import type { MouseAware, MousePoint, MouseTarget } from '../mouse/hit-test.js';
import { theme } from '../theme.js';
import { ListWindow } from './list-window.js';

export interface PickerListOptions<T> {
  /** Items shown at once before the list scrolls; omit to show every item. */
  maxVisible?: number;
  /** The scroll window, when the menu needs it too (to know which items are visible). */
  window?: ListWindow;
  /** Cut each line to the list width instead of wrapping it. */
  truncate?: boolean;
  /** Lines for one item; each line wraps to the list width like a `Text`. */
  renderItem: (item: T, selected: boolean, index: number) => string[];
  /** Called with the clicked item's index. Pickers should do whatever Enter does. */
  onActivate: (index: number) => void;
  /** Shown when there are no items; omit to render nothing. */
  emptyText?: () => string;
}

export class PickerList<T> implements Component, MouseAware {
  private readonly window: ListWindow;
  private items: T[] = [];
  private selectedIndex = 0;
  /** Rows for the current items, kept between frames so each `Text` keeps its wrap cache. */
  private rows: Component[] = [];
  /** The visible items' rows, grouped by item index, for mapping clicks back to items. */
  private itemRows: { index: number; rows: Component[] }[] = [];
  private builtRange = { startIndex: 0, endIndex: 0 };

  constructor(private readonly options: PickerListOptions<T>) {
    this.window = options.window ?? new ListWindow();
  }

  menuWindow(): ListWindow {
    return this.window;
  }

  setItems(items: T[], selectedIndex: number): void {
    this.items = items;
    this.selectedIndex = selectedIndex;
    this.build(this.range());
  }

  render(width: number): string[] {
    // A shorter terminal shows fewer items than when the rows were built.
    const range = this.range();
    if (range.startIndex !== this.builtRange.startIndex || range.endIndex !== this.builtRange.endIndex) {
      this.build(range);
    }
    return this.rows.flatMap(row => row.render(width));
  }

  mouseTarget(point: MousePoint): MouseTarget | undefined {
    let top = 0;
    for (const { index, rows } of this.itemRows) {
      const height = rows.reduce((sum, row) => sum + row.render(point.width).length, 0);
      if (point.row < top + height) return { top, height, activate: () => this.options.onActivate(index) };
      top += height;
    }
    return undefined;
  }

  invalidate(): void {
    for (const row of this.rows) row.invalidate();
  }

  private range(): { startIndex: number; endIndex: number } {
    const { maxVisible = Number.POSITIVE_INFINITY } = this.options;
    return this.window.range(this.selectedIndex, this.items.length, maxVisible);
  }

  private build(range: { startIndex: number; endIndex: number }): void {
    const { renderItem, emptyText, truncate } = this.options;
    const { items, selectedIndex } = this;
    this.builtRange = range;
    this.rows = [];
    this.itemRows = [];
    if (items.length === 0) {
      const emptyLine = emptyText?.();
      if (emptyLine !== undefined) this.rows.push(new Text(theme.fg('muted', emptyLine), 0, 0));
      return;
    }

    for (let i = range.startIndex; i < range.endIndex; i++) {
      const rows = renderItem(items[i] as T, i === selectedIndex, i).map(line =>
        truncate ? new TruncatedText(line, 0, 0) : new Text(line, 0, 0),
      );
      this.rows.push(...rows);
      this.itemRows.push({ index: i, rows });
    }
    if (range.endIndex - range.startIndex < items.length) {
      this.rows.push(new Text(theme.fg('dim', `  (${selectedIndex + 1}/${items.length})`), 0, 0));
    }
  }
}
