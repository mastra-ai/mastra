/**
 * What a menu tells the prompt slot about itself. Menus open with a title (`showModalOverlay(…, { title })`);
 * these optional hooks cover what changes while a menu is open.
 */
import type { Component } from '@earendil-works/pi-tui';

/** A menu-specific key shown under the menu as a keycap, e.g. tab to clone a thread. */
export interface MenuHint {
  key: string;
  label: string;
}

/** A list that typing in the prompt slot filters. */
export interface Filterable {
  setFilter(query: string): void;
}

export interface MenuChrome {
  /** Overrides the opening title while the menu is open, e.g. "settings › notifications" in a submenu. */
  menuTitle?(): string | undefined;
  /** Keys that only this menu has. Shared keys (↑↓, enter, esc) are never shown. */
  menuHints?(): readonly MenuHint[];
  /** The list typing filters right now (a submenu's list while it is open), or undefined for none. */
  menuFilterTarget?(): Filterable | undefined;
  /**
   * Backspace on an empty search goes back (closes the menu) unless this is true; the menu then gets
   * it itself (e.g. /api-keys removes a key with the Mac delete key, a question is not skipped).
   */
  readonly menuKeepsBackspace?: boolean;
}

/** The list that typing should filter: the first component in the tree that names one. */
export function findFilterTarget(component: Component): Filterable | undefined {
  const chrome = component as MenuChrome;
  if (typeof chrome.menuFilterTarget === 'function') return chrome.menuFilterTarget();
  for (const child of (component as { children?: Component[] }).children ?? []) {
    const target = findFilterTarget(child);
    if (target) return target;
  }
  return undefined;
}
