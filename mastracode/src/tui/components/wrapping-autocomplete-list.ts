/**
 * Drop-in replacement for pi-tui's `SelectList` used by the editor's
 * slash-command / autocomplete dropdown. Behaves like `SelectList` (same
 * prefix, primary column, and description styling) but word-wraps long
 * descriptions across multiple terminal rows instead of truncating them on a
 * single line. Continuation rows are indented under the description column so
 * the full command/skill description stays readable without widening the
 * terminal.
 *
 * Arrow keys move item-to-item (not row-to-row), so navigation stays
 * predictable regardless of how many rows a description wraps onto.
 */

import { getKeybindings, truncateToWidth, visibleWidth, wrapTextWithAnsi } from '@mariozechner/pi-tui';
import type { Component, SelectItem, SelectListTheme } from '@mariozechner/pi-tui';

const DEFAULT_PRIMARY_COLUMN_WIDTH = 32;
const PRIMARY_COLUMN_GAP = 2;
const MIN_DESCRIPTION_WIDTH = 10;
const DESCRIPTION_WIDTH_THRESHOLD = 40;

export interface WrappingAutocompleteListLayout {
  minPrimaryColumnWidth?: number;
  maxPrimaryColumnWidth?: number;
}

const normalizeToSingleLine = (text: string): string => text.replace(/[\r\n]+/g, ' ').trim();
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(value, max));

export class WrappingAutocompleteList implements Component {
  private items: SelectItem[];
  private filteredItems: SelectItem[];
  private selectedIndex = 0;
  private maxVisible: number;
  private theme: SelectListTheme;
  private layout: WrappingAutocompleteListLayout;

  onSelect?: (item: SelectItem) => void;
  onCancel?: () => void;
  onSelectionChange?: (item: SelectItem) => void;

  constructor(
    items: SelectItem[],
    maxVisible: number,
    theme: SelectListTheme,
    layout: WrappingAutocompleteListLayout = {},
  ) {
    this.items = items;
    this.filteredItems = items;
    this.maxVisible = maxVisible;
    this.theme = theme;
    this.layout = layout;
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
      lines.push(this.theme.noMatch('  No matching commands'));
      return lines;
    }

    const primaryColumnWidth = this.getPrimaryColumnWidth();
    const startIndex = Math.max(
      0,
      Math.min(this.selectedIndex - Math.floor(this.maxVisible / 2), this.filteredItems.length - this.maxVisible),
    );
    const endIndex = Math.min(startIndex + this.maxVisible, this.filteredItems.length);

    for (let i = startIndex; i < endIndex; i++) {
      const item = this.filteredItems[i];
      if (!item) continue;
      const isSelected = i === this.selectedIndex;
      const description = item.description ? normalizeToSingleLine(item.description) : undefined;
      for (const row of this.renderItem(item, isSelected, width, description, primaryColumnWidth)) {
        lines.push(row);
      }
    }

    if (startIndex > 0 || endIndex < this.filteredItems.length) {
      const scrollText = `  (${this.selectedIndex + 1}/${this.filteredItems.length})`;
      lines.push(this.theme.scrollInfo(truncateToWidth(scrollText, width - 2, '')));
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

  private renderItem(
    item: SelectItem,
    isSelected: boolean,
    width: number,
    description: string | undefined,
    primaryColumnWidth: number,
  ): string[] {
    const prefix = isSelected ? '→ ' : '  ';
    const prefixWidth = visibleWidth(prefix);

    if (description && width > DESCRIPTION_WIDTH_THRESHOLD) {
      const effectivePrimaryColumnWidth = Math.max(1, Math.min(primaryColumnWidth, width - prefixWidth - 4));
      const maxPrimaryWidth = Math.max(1, effectivePrimaryColumnWidth - PRIMARY_COLUMN_GAP);
      const truncatedValue = this.truncatePrimary(item, maxPrimaryWidth);
      const truncatedValueWidth = visibleWidth(truncatedValue);
      const spacing = ' '.repeat(Math.max(1, effectivePrimaryColumnWidth - truncatedValueWidth));
      const descriptionStart = prefixWidth + truncatedValueWidth + spacing.length;
      const remainingWidth = width - descriptionStart - 2; // -2 for safety, mirrors SelectList

      if (remainingWidth > MIN_DESCRIPTION_WIDTH) {
        // Wrap the description across rows instead of truncating it. The first
        // row keeps the primary column; continuation rows indent under the
        // description column so the wrapped text aligns.
        const wrapped = wrapTextWithAnsi(description, remainingWidth);
        const continuationIndent = ' '.repeat(descriptionStart);

        return wrapped.map((chunk, index) => {
          if (index === 0) {
            if (isSelected) {
              return this.theme.selectedText(`${prefix}${truncatedValue}${spacing}${chunk}`);
            }
            return prefix + truncatedValue + this.theme.description(spacing + chunk);
          }
          if (isSelected) {
            return this.theme.selectedText(`${continuationIndent}${chunk}`);
          }
          return this.theme.description(continuationIndent + chunk);
        });
      }
    }

    const maxWidth = width - prefixWidth - 2;
    const truncatedValue = this.truncatePrimary(item, maxWidth);
    if (isSelected) {
      return [this.theme.selectedText(`${prefix}${truncatedValue}`)];
    }
    return [prefix + truncatedValue];
  }

  private getPrimaryColumnWidth(): number {
    const { min, max } = this.getPrimaryColumnBounds();
    const widestPrimary = this.filteredItems.reduce(
      (widest, item) => Math.max(widest, visibleWidth(this.getDisplayValue(item)) + PRIMARY_COLUMN_GAP),
      0,
    );
    return clamp(widestPrimary, min, max);
  }

  private getPrimaryColumnBounds(): { min: number; max: number } {
    const rawMin =
      this.layout.minPrimaryColumnWidth ?? this.layout.maxPrimaryColumnWidth ?? DEFAULT_PRIMARY_COLUMN_WIDTH;
    const rawMax =
      this.layout.maxPrimaryColumnWidth ?? this.layout.minPrimaryColumnWidth ?? DEFAULT_PRIMARY_COLUMN_WIDTH;
    return {
      min: Math.max(1, Math.min(rawMin, rawMax)),
      max: Math.max(1, Math.max(rawMin, rawMax)),
    };
  }

  private truncatePrimary(item: SelectItem, maxWidth: number): string {
    return truncateToWidth(this.getDisplayValue(item), maxWidth, '');
  }

  private getDisplayValue(item: SelectItem): string {
    return item.label || item.value;
  }

  private notifySelectionChange(): void {
    const selected = this.filteredItems[this.selectedIndex];
    if (selected && this.onSelectionChange) this.onSelectionChange(selected);
  }
}
