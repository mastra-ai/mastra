/**
 * Base class for searchable list overlay components.
 * Provides: search input, fuzzy filtering, scrollable list with keyboard navigation,
 * and Focusable implementation for use with TUI.showOverlay().
 *
 * Subclasses must implement:
 *   - getSearchableText(item): string to extract for fuzzy matching
 *   - renderItem(item, index, isSelected): Text component(s) for each list row
 *   - onSelect(item): called when user confirms selection
 *   - onCancel(): called when user presses Escape/Ctrl+C
 *
 * Subclasses may override:
 *   - getEmptyMessage(): string shown when no items match the filter
 *   - maxVisible: number of items visible at once (default 12)
 */

import { Box, Container, fuzzyFilter, getEditorKeybindings, Input, Spacer, Text } from '@mariozechner/pi-tui';
import type { Focusable, TUI } from '@mariozechner/pi-tui';
import { theme } from '../theme.js';

export interface SearchableListOverlayOptions {
  /** TUI instance for rendering */
  tui: TUI;
  /** Title displayed at the top of the overlay */
  title: string;
  /** Hint text below the title */
  hint?: string;
  /** Maximum number of visible items in the list (default 12) */
  maxVisible?: number;
}

export abstract class SearchableListOverlay<T> extends Box implements Focusable {
  protected readonly searchInput: Input;
  protected readonly listContainer: Container;
  protected readonly tui: TUI;
  protected readonly maxVisible: number;

  protected allItems: T[];
  protected filteredItems: T[];
  protected selectedIndex = 0;

  // Focusable implementation
  private _focused = false;
  get focused(): boolean {
    return this._focused;
  }
  set focused(value: boolean) {
    this._focused = value;
    this.searchInput.focused = value;
  }

  constructor(options: SearchableListOverlayOptions, items: T[]) {
    super(2, 1, text => theme.bg('overlayBg', text));

    this.tui = options.tui;
    this.maxVisible = options.maxVisible ?? 12;
    this.allItems = items;
    this.filteredItems = items;

    // Title
    this.addChild(new Text(this.renderTitle(options.title), 0, 0));
    this.addChild(new Spacer(1));

    // Hint
    const hint = options.hint ?? 'Type to search • ↑↓ navigate • Enter select • Esc cancel';
    this.addChild(new Text(theme.fg('muted', hint), 0, 0));
    this.addChild(new Spacer(1));

    // Search input
    this.searchInput = new Input();
    this.searchInput.onSubmit = () => {
      this.confirmSelection();
    };
    this.addChild(this.searchInput);
    this.addChild(new Spacer(1));

    // List container
    this.listContainer = new Container();
    this.addChild(this.listContainer);

    // Initial render
    this.updateList();
  }

  // ---------------------------------------------------------------------------
  // Abstract methods — subclasses must implement
  // ---------------------------------------------------------------------------

  /** Extract text from an item for fuzzy matching. */
  protected abstract getSearchableText(item: T): string;

  /** Render a single list item. Return one or more Text components. */
  protected abstract renderItem(item: T, index: number, isSelected: boolean): Text[];

  /** Called when the user confirms a selection. */
  protected abstract onSelect(item: T): void;

  /** Called when the user cancels (Escape / Ctrl+C). */
  protected abstract onCancel(): void;

  // ---------------------------------------------------------------------------
  // Overridable hooks
  // ---------------------------------------------------------------------------

  /** Title rendering — override for custom styling (e.g., colored background). */
  protected renderTitle(title: string): string {
    return theme.bold(theme.fg('accent', title));
  }

  /** Message shown when no items match the filter. */
  protected getEmptyMessage(): string {
    return 'No matches';
  }

  /**
   * Get the total number of items, including any virtual items.
   * Override to add synthetic items (e.g., "Use: query" in model selector).
   */
  protected getTotalItemCount(): number {
    return this.filteredItems.length;
  }

  /**
   * Handle confirm for the currently selected index.
   * Override to handle synthetic items at specific indices.
   */
  protected confirmSelection(): void {
    const selected = this.filteredItems[this.selectedIndex];
    if (selected) {
      this.onSelect(selected);
    }
  }

  // ---------------------------------------------------------------------------
  // Core list logic
  // ---------------------------------------------------------------------------

  /** Re-filter items based on the current search query. */
  protected filterItems(query: string): void {
    this.filteredItems = query
      ? fuzzyFilter(this.allItems, query, item => this.getSearchableText(item))
      : this.allItems;

    const total = this.getTotalItemCount();
    this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, total - 1));
    this.updateList();
  }

  /** Rebuild the list container with the current filtered items and selection. */
  protected updateList(): void {
    this.listContainer.clear();

    const total = this.getTotalItemCount();
    const startIndex = Math.max(0, Math.min(this.selectedIndex - Math.floor(this.maxVisible / 2), total - this.maxVisible));
    const endIndex = Math.min(startIndex + this.maxVisible, total);

    for (let i = startIndex; i < endIndex; i++) {
      const isSelected = i === this.selectedIndex;
      const itemTexts = this.renderListRow(i, isSelected);
      for (const t of itemTexts) {
        this.listContainer.addChild(t);
      }
    }

    // Scroll indicator
    if (startIndex > 0 || endIndex < total) {
      this.listContainer.addChild(new Text(theme.fg('muted', `(${this.selectedIndex + 1}/${total})`), 0, 0));
    }

    // Empty state
    if (total === 0) {
      this.listContainer.addChild(new Text(theme.fg('muted', this.getEmptyMessage()), 0, 0));
    }
  }

  /**
   * Render a single row by index. Override to inject synthetic rows.
   * Default implementation delegates to renderItem().
   */
  protected renderListRow(index: number, isSelected: boolean): Text[] {
    const item = this.filteredItems[index];
    if (!item) return [];
    return this.renderItem(item, index, isSelected);
  }

  // ---------------------------------------------------------------------------
  // Input handling
  // ---------------------------------------------------------------------------

  handleInput(keyData: string): void {
    const kb = getEditorKeybindings();
    const total = this.getTotalItemCount();

    if (kb.matches(keyData, 'selectUp')) {
      if (total === 0) return;
      this.selectedIndex = this.selectedIndex === 0 ? total - 1 : this.selectedIndex - 1;
      this.updateList();
      this.tui.requestRender();
    } else if (kb.matches(keyData, 'selectDown')) {
      if (total === 0) return;
      this.selectedIndex = this.selectedIndex === total - 1 ? 0 : this.selectedIndex + 1;
      this.updateList();
      this.tui.requestRender();
    } else if (kb.matches(keyData, 'selectConfirm')) {
      this.confirmSelection();
    } else if (kb.matches(keyData, 'selectCancel')) {
      this.onCancel();
    } else {
      this.searchInput.handleInput(keyData);
      this.filterItems(this.searchInput.getValue());
      this.tui.requestRender();
    }
  }

  /** Get the current search query value. */
  getSearchValue(): string {
    return this.searchInput.getValue();
  }
}
