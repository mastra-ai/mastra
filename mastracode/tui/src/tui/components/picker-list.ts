/**
 * Scrolling list body shared by hand-drawn pickers. The picker keeps its own
 * selection and key handling; this draws the visible window of items, each of
 * which may span several rows, plus the `(n/total)` scroll indicator, and maps
 * mouse rows back to the item drawn there.
 */

import { Text } from '@earendil-works/pi-tui';
import type { Component } from '@earendil-works/pi-tui';
import type { MouseAware, MousePoint, MouseTarget } from '../mouse/hit-test.js';
import { theme } from '../theme.js';

export interface PickerListOptions<T> {
  /** Items shown at once before the list scrolls; omit to show every item. */
  maxVisible?: number;
  /** Lines for one item; each line wraps to the list width like a `Text`. */
  renderItem: (item: T, selected: boolean, index: number) => string[];
  /** Called with the clicked item's index. Pickers should do whatever Enter does. */
  onActivate: (index: number) => void;
  /** Shown when there are no items; omit to render nothing. */
  emptyText?: () => string;
  /** `Text` padding around each line, for pickers that draw rows as padded `Text`s. */
  paddingX?: number;
  paddingY?: number;
}

export class PickerList<T> implements Component, MouseAware {
  /** Rows for the current items, built when items are set (like the hand-drawn loops did) so each `Text` keeps its wrap cache between frames. */
  private rows: Text[] = [];
  /** The visible items' rows, grouped by item index, for mapping clicks back to items. */
  private itemRows: { index: number; rows: Text[] }[] = [];

  constructor(private readonly options: PickerListOptions<T>) {}

  setItems(items: T[], selectedIndex: number): void {
    const { maxVisible = Number.POSITIVE_INFINITY, renderItem, emptyText, paddingX = 0, paddingY = 0 } = this.options;
    this.rows = [];
    this.itemRows = [];
    if (items.length === 0) {
      const emptyLine = emptyText?.();
      if (emptyLine !== undefined) this.rows.push(new Text(theme.fg('muted', emptyLine), 0, 0));
      return;
    }

    const startIndex = Math.max(0, Math.min(selectedIndex - Math.floor(maxVisible / 2), items.length - maxVisible));
    const endIndex = Math.min(startIndex + maxVisible, items.length);
    for (let i = startIndex; i < endIndex; i++) {
      const rows = renderItem(items[i] as T, i === selectedIndex, i).map(line => new Text(line, paddingX, paddingY));
      this.rows.push(...rows);
      this.itemRows.push({ index: i, rows });
    }
    if (startIndex > 0 || endIndex < items.length) {
      this.rows.push(new Text(theme.fg('muted', `(${selectedIndex + 1}/${items.length})`), 0, 0));
    }
  }

  render(width: number): string[] {
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
}
