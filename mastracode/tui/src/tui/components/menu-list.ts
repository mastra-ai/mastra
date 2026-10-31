/**
 * The list every menu uses: one row per item with the label in a column sized to the longest label and
 * its description in a dim second column, an accent arrow and bold label on the selected row, wrap-around
 * arrow keys, a window that scrolls only at its edges, and type-to-filter (the prompt slot calls
 * `setFilter` as you type).
 */
import { fuzzyFilter, getKeybindings, Text, truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import type { Component, SelectItem } from '@earendil-works/pi-tui';

import { menuCursor, menuSelected, theme } from '../theme.js';
import { ListWindow } from './list-window.js';
import type { Filterable, MenuChrome } from './menu-chrome.js';

/** Labels longer than this are truncated so the description column stays readable. */
const MAX_LABEL_COLUMN = 44;
/** Space between the label column and the description column. */
const COLUMN_GAP = 3;

const SGR = /\x1b\[[0-9;:]*m/g;
const plain = (text: string) => text.replace(SGR, '');

/** Width of a label column that fits every label (up to the cap), gap included. */
export function labelColumnWidth(labels: readonly string[]): number {
  const widest = Math.max(0, ...labels.map(label => visibleWidth(plain(label))));
  return Math.min(MAX_LABEL_COLUMN, widest) + COLUMN_GAP;
}

/**
 * One menu row, for lists that draw their own rows (threads, models, MCP servers): cursor, label padded
 * to `column`, then `details`. Colors inside `label` and `details` are kept; the selected label is bold.
 */
export function menuRow(selected: boolean, label: string, details = '', column = 0): string {
  const cursor = selected ? menuCursor() : '  ';
  const shown = selected ? menuSelected(plain(label)) : theme.fg('secondary', label);
  if (!details) return cursor + shown;
  const pad = ' '.repeat(Math.max(2, column - visibleWidth(plain(label))));
  return cursor + shown + pad + details;
}

/** A note under a menu's list ("Session override — …"), starting where the row labels start. */
export function menuNote(text: string, color: 'dim' | 'warning' | 'error' = 'dim'): Text {
  return new Text(theme.fg(color, text), 2, 0);
}

export class MenuList implements Component, Filterable, MenuChrome {
  private items: SelectItem[];
  private filteredItems: SelectItem[];
  private selectedIndex = 0;
  private readonly window = new ListWindow();

  onSelect?: (item: SelectItem) => void;
  onCancel?: () => void;
  onSelectionChange?: (item: SelectItem) => void;

  constructor(
    items: SelectItem[],
    private readonly maxVisible = 12,
  ) {
    this.items = items;
    this.filteredItems = items;
  }

  menuFilterTarget(): Filterable {
    return this;
  }

  /** Keeps the items whose label fuzzy-matches `query`, best match first, and selects the first. */
  setFilter(query: string): void {
    this.filteredItems = query.trim()
      ? fuzzyFilter(this.items, query, item => plain(item.label || item.value))
      : this.items;
    this.selectedIndex = 0;
    this.notifySelectionChange();
  }

  setSelectedIndex(index: number): void {
    this.selectedIndex = Math.max(0, Math.min(index, this.filteredItems.length - 1));
  }

  getSelectedItem(): SelectItem | null {
    return this.filteredItems[this.selectedIndex] ?? null;
  }

  invalidate(): void {}

  render(width: number): string[] {
    if (this.filteredItems.length === 0) return [theme.fg('muted', '  no matches')];

    const column = labelColumnWidth(this.items.filter(item => item.description).map(item => item.label || item.value));
    const labelWidth = column - COLUMN_GAP;
    const { startIndex, endIndex } = this.window.range(this.selectedIndex, this.filteredItems.length, this.maxVisible);
    const lines: string[] = [];
    for (let i = startIndex; i < endIndex; i++) {
      const item = this.filteredItems[i]!;
      // Only rows with a description need their label cut to the column.
      const label = item.description ? truncateToWidth(item.label || item.value, labelWidth) : item.label || item.value;
      const details = item.description ? theme.fg('muted', item.description) : '';
      lines.push(truncateToWidth(menuRow(i === this.selectedIndex, label, details, column), width));
    }
    if (this.filteredItems.length > this.maxVisible) {
      lines.push(theme.fg('dim', `  (${this.selectedIndex + 1}/${this.filteredItems.length})`));
    }
    return lines;
  }

  handleInput(keyData: string): void {
    const kb = getKeybindings();
    const count = this.filteredItems.length;
    if (kb.matches(keyData, 'tui.select.up')) {
      if (count === 0) return;
      this.selectedIndex = this.selectedIndex === 0 ? count - 1 : this.selectedIndex - 1;
      this.notifySelectionChange();
    } else if (kb.matches(keyData, 'tui.select.down')) {
      if (count === 0) return;
      this.selectedIndex = this.selectedIndex === count - 1 ? 0 : this.selectedIndex + 1;
      this.notifySelectionChange();
    } else if (kb.matches(keyData, 'tui.select.confirm')) {
      const selected = this.filteredItems[this.selectedIndex];
      if (selected) this.onSelect?.(selected);
    } else if (kb.matches(keyData, 'tui.select.cancel')) {
      this.onCancel?.();
    }
  }

  private notifySelectionChange(): void {
    const selected = this.filteredItems[this.selectedIndex];
    if (selected) this.onSelectionChange?.(selected);
  }
}
