/**
 * Drop-in replacement for pi-tui's `SelectList` that wraps long item labels
 * across multiple terminal rows with a `↳ ` continuation marker instead of
 * truncating them. Arrow keys move item-to-item — not row-to-row — so
 * navigation stays predictable regardless of label height.
 */

import { getKeybindings, wrapTextWithAnsi } from '@mariozechner/pi-tui';
import type { Component, SelectItem, SelectListTheme } from '@mariozechner/pi-tui';

const SELECTED_PREFIX = '→ ';
const UNSELECTED_PREFIX = '  ';
const CONTINUATION_PREFIX = '↳ ';
const PREFIX_WIDTH = 2;

export class WrappingSelectList implements Component {
  private items: SelectItem[];
  private filteredItems: SelectItem[];
  private selectedIndex = 0;
  private maxVisible: number;
  private theme: SelectListTheme;

  onSelect?: (item: SelectItem) => void;
  onCancel?: () => void;
  onSelectionChange?: (item: SelectItem) => void;

  constructor(items: SelectItem[], maxVisible: number, theme: SelectListTheme) {
    this.items = items;
    this.filteredItems = items;
    this.maxVisible = maxVisible;
    this.theme = theme;
  }

  setFilter(filter: string): void {
    this.filteredItems = this.items.filter(item => item.value.toLowerCase().startsWith(filter.toLowerCase()));
    this.selectedIndex = 0;
  }

  setSelectedIndex(index: number): void {
    this.selectedIndex = Math.max(0, Math.min(index, this.filteredItems.length - 1));
  }

  invalidate(): void {}

  getSelectedItem(): SelectItem | null {
    return this.filteredItems[this.selectedIndex] ?? null;
  }

  render(width: number): string[] {
    const lines: string[] = [];

    if (this.filteredItems.length === 0) {
      lines.push(this.theme.noMatch('  No matching items'));
      return lines;
    }

    const startIndex = Math.max(
      0,
      Math.min(this.selectedIndex - Math.floor(this.maxVisible / 2), this.filteredItems.length - this.maxVisible),
    );
    const endIndex = Math.min(startIndex + this.maxVisible, this.filteredItems.length);

    for (let i = startIndex; i < endIndex; i++) {
      const item = this.filteredItems[i];
      if (!item) continue;
      const isSelected = i === this.selectedIndex;
      for (const row of this.renderItem(item, isSelected, width)) {
        lines.push(row);
      }
    }

    if (startIndex > 0 || endIndex < this.filteredItems.length) {
      lines.push(this.theme.scrollInfo(`  (${this.selectedIndex + 1}/${this.filteredItems.length})`));
    }

    return lines;
  }

  handleInput(keyData: string): void {
    const kb = getKeybindings();

    if (kb.matches(keyData, 'tui.select.up')) {
      this.selectedIndex = this.selectedIndex === 0 ? this.filteredItems.length - 1 : this.selectedIndex - 1;
      this.notifySelectionChange();
    } else if (kb.matches(keyData, 'tui.select.down')) {
      this.selectedIndex = this.selectedIndex === this.filteredItems.length - 1 ? 0 : this.selectedIndex + 1;
      this.notifySelectionChange();
    } else if (kb.matches(keyData, 'tui.select.confirm')) {
      const selected = this.filteredItems[this.selectedIndex];
      if (selected && this.onSelect) this.onSelect(selected);
    } else if (kb.matches(keyData, 'tui.select.cancel')) {
      this.onCancel?.();
    }
  }

  private renderItem(item: SelectItem, isSelected: boolean, width: number): string[] {
    const labelText = this.getDisplayValue(item);
    const labelWidth = Math.max(1, width - PREFIX_WIDTH);
    const wrapped = wrapTextWithAnsi(labelText, labelWidth);

    if (wrapped.length === 0) {
      const prefix = isSelected ? SELECTED_PREFIX : UNSELECTED_PREFIX;
      const rendered = `${prefix}`;
      return [isSelected ? this.theme.selectedText(rendered) : rendered];
    }

    return wrapped.map((chunk, index) => {
      const prefix = index === 0 ? (isSelected ? SELECTED_PREFIX : UNSELECTED_PREFIX) : CONTINUATION_PREFIX;
      const rendered = `${prefix}${chunk}`;
      if (isSelected) return this.theme.selectedText(rendered);
      if (prefix === CONTINUATION_PREFIX) return this.theme.description(rendered);
      return rendered;
    });
  }

  private getDisplayValue(item: SelectItem): string {
    return item.label || item.value;
  }

  private notifySelectionChange(): void {
    const selected = this.filteredItems[this.selectedIndex];
    if (selected && this.onSelectionChange) this.onSelectionChange(selected);
  }
}
