/**
 * Settings list for menus (/settings, /om): label and value columns, Enter or Space changes a value or
 * opens its submenu, the selected setting's description under the list. Same rows, scrolling and
 * filtering as `MenuList`; replaces pi-tui's `SettingsList`, which centers the selection, caps labels at
 * 30 columns and draws its own search field and hint line.
 */
import { fuzzyFilter, getKeybindings, truncateToWidth, wrapTextWithAnsi } from '@earendil-works/pi-tui';
import type { Component, SettingItem } from '@earendil-works/pi-tui';

import { theme } from '../theme.js';
import { ListWindow } from './list-window.js';
import { findFilterTarget } from './menu-chrome.js';
import type { Filterable, MenuChrome } from './menu-chrome.js';
import { labelColumnWidth, menuRow } from './menu-list.js';

export class SettingsMenu implements Component, Filterable, MenuChrome {
  private filteredItems: SettingItem[];
  private selectedIndex = 0;
  private readonly window = new ListWindow();
  private submenu: { component: Component; item: SettingItem } | null = null;

  constructor(
    private readonly items: SettingItem[],
    private readonly maxVisible: number,
    private readonly onChange: (id: string, newValue: string) => void,
    private readonly onCancel: () => void,
  ) {
    this.filteredItems = items;
  }

  updateValue(id: string, newValue: string): void {
    const item = this.items.find(candidate => candidate.id === id);
    if (item) item.currentValue = newValue;
  }

  /** Label of the setting whose submenu is open, for the menu's breadcrumb. */
  openSubmenuLabel(): string | undefined {
    return this.submenu?.item.label;
  }

  menuFilterTarget(): Filterable | undefined {
    return this.submenu ? findFilterTarget(this.submenu.component) : this;
  }

  setFilter(query: string): void {
    this.filteredItems = query.trim() ? fuzzyFilter(this.items, query, item => item.label) : this.items;
    this.selectedIndex = 0;
  }

  invalidate(): void {
    this.submenu?.component.invalidate?.();
  }

  render(width: number): string[] {
    if (this.submenu) return this.submenu.component.render(width);
    if (this.filteredItems.length === 0) return [theme.fg('muted', '  no matches')];

    const column = labelColumnWidth(this.items.map(item => item.label));
    const { startIndex, endIndex } = this.window.range(this.selectedIndex, this.filteredItems.length, this.maxVisible);
    const lines: string[] = [];
    for (let i = startIndex; i < endIndex; i++) {
      const item = this.filteredItems[i]!;
      const selected = i === this.selectedIndex;
      const value = theme.fg(selected ? 'text' : 'muted', item.currentValue);
      lines.push(truncateToWidth(menuRow(selected, item.label, value, column), width));
    }
    if (this.filteredItems.length > this.maxVisible) {
      lines.push(theme.fg('dim', `  (${this.selectedIndex + 1}/${this.filteredItems.length})`));
    }
    const description = this.filteredItems[this.selectedIndex]?.description;
    if (description) {
      lines.push('');
      for (const line of wrapTextWithAnsi(description, Math.max(1, width - 4))) {
        lines.push(theme.fg('muted', `  ${line}`));
      }
    }
    return lines;
  }

  handleInput(data: string): void {
    if (this.submenu) {
      this.submenu.component.handleInput?.(data);
      return;
    }
    const kb = getKeybindings();
    const count = this.filteredItems.length;
    if (kb.matches(data, 'tui.select.up')) {
      if (count > 0) this.selectedIndex = this.selectedIndex === 0 ? count - 1 : this.selectedIndex - 1;
    } else if (kb.matches(data, 'tui.select.down')) {
      if (count > 0) this.selectedIndex = this.selectedIndex === count - 1 ? 0 : this.selectedIndex + 1;
    } else if (kb.matches(data, 'tui.select.confirm') || data === ' ') {
      this.activate();
    } else if (kb.matches(data, 'tui.select.cancel')) {
      this.onCancel();
    }
  }

  private activate(): void {
    const item = this.filteredItems[this.selectedIndex];
    if (!item) return;
    if (item.submenu) {
      const returnIndex = this.selectedIndex;
      let closed = false;
      const component = item.submenu(item.currentValue, selectedValue => {
        closed = true;
        if (selectedValue !== undefined) {
          item.currentValue = selectedValue;
          this.onChange(item.id, selectedValue);
        }
        this.submenu = null;
        this.selectedIndex = returnIndex;
      });
      if (!closed) this.submenu = { component, item };
    } else if (item.values?.length) {
      const next = item.values[(item.values.indexOf(item.currentValue) + 1) % item.values.length]!;
      item.currentValue = next;
      this.onChange(item.id, next);
    }
  }
}
