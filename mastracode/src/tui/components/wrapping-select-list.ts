/**
 * Drop-in replacement for pi-tui's `SelectList` that wraps long item labels
 * across multiple terminal rows with a `↳ ` continuation marker instead of
 * truncating them. Arrow keys move item-to-item — not row-to-row — so
 * navigation stays predictable regardless of label height.
 */

import { getKeybindings, wrapTextWithAnsi } from '@earendil-works/pi-tui';
import type { Component, SelectItem, SelectListTheme } from '@earendil-works/pi-tui';

const SELECTED_PREFIX = '→ ';
const UNSELECTED_PREFIX = '  ';
const CONTINUATION_PREFIX = '↳ ';
const PREFIX_WIDTH = 2;
const CHECKBOX_CHECKED = '[x] ';
const CHECKBOX_UNCHECKED = '[ ] ';
const CHECKBOX_WIDTH = 4;

export class WrappingSelectList implements Component {
  private items: SelectItem[];
  private filteredItems: SelectItem[];
  private selectedIndex = 0;
  private maxVisible: number;
  private theme: SelectListTheme;
  /** When true, items are toggled (space) and confirmed together (enter) instead of selected one at a time. */
  private multiSelect: boolean;
  /** Values toggled on in multi-select mode. */
  private checkedValues = new Set<string>();

  onSelect?: (item: SelectItem) => void;
  onCancel?: () => void;
  onSelectionChange?: (item: SelectItem) => void;
  /** Called when the user confirms a multi-select list with Enter; receives all checked items in display order. */
  onConfirmMulti?: (items: SelectItem[]) => void;

  constructor(items: SelectItem[], maxVisible: number, theme: SelectListTheme, multiSelect = false) {
    this.items = items;
    this.filteredItems = items;
    this.maxVisible = maxVisible;
    this.theme = theme;
    this.multiSelect = multiSelect;
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
    } else if (this.multiSelect && keyData === ' ') {
      const current = this.filteredItems[this.selectedIndex];
      if (current) {
        if (this.checkedValues.has(current.value)) {
          this.checkedValues.delete(current.value);
        } else {
          this.checkedValues.add(current.value);
        }
      }
    } else if (kb.matches(keyData, 'tui.select.confirm')) {
      if (this.multiSelect) {
        const checked = this.items.filter(item => this.checkedValues.has(item.value));
        this.onConfirmMulti?.(checked);
        return;
      }
      const selected = this.filteredItems[this.selectedIndex];
      if (selected && this.onSelect) this.onSelect(selected);
    } else if (kb.matches(keyData, 'tui.select.cancel')) {
      this.onCancel?.();
    }
  }

  private renderItem(item: SelectItem, isSelected: boolean, width: number): string[] {
    const labelText = this.getDisplayValue(item);
    // In multi-select mode each row carries a `[x] `/`[ ] ` checkbox after the
    // cursor prefix, so reserve that extra width when wrapping the label.
    const checkboxWidth = this.multiSelect ? CHECKBOX_WIDTH : 0;
    const labelWidth = Math.max(1, width - PREFIX_WIDTH - checkboxWidth);
    const wrapped = wrapTextWithAnsi(labelText, labelWidth);
    const checkbox = this.multiSelect
      ? this.checkedValues.has(item.value)
        ? CHECKBOX_CHECKED
        : CHECKBOX_UNCHECKED
      : '';

    if (wrapped.length === 0) {
      const prefix = isSelected ? SELECTED_PREFIX : UNSELECTED_PREFIX;
      const rendered = `${prefix}${checkbox}`;
      return [isSelected ? this.theme.selectedText(rendered) : rendered];
    }

    return wrapped.map((chunk, index) => {
      const cursorPrefix = index === 0 ? (isSelected ? SELECTED_PREFIX : UNSELECTED_PREFIX) : CONTINUATION_PREFIX;
      // Only the first row shows the checkbox; continuation rows indent to align.
      const boxPart = index === 0 ? checkbox : ' '.repeat(checkbox.length);
      const rendered = `${cursorPrefix}${boxPart}${chunk}`;
      if (isSelected) return this.theme.selectedText(rendered);
      if (cursorPrefix === CONTINUATION_PREFIX) return this.theme.description(rendered);
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
