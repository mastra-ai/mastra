/**
 * What a menu tells the prompt slot about itself. Menus open with a title (`showModalOverlay(…, { title })`);
 * these optional hooks cover what changes while a menu is open.
 */
import type { Component } from '@earendil-works/pi-tui';

import type { ListWindow } from './list-window.js';

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
  /** The scroll window of the list on screen, which the frame shrinks to fit a short terminal. */
  menuWindow?(): ListWindow | undefined;
  /**
   * Backspace on an empty search goes back (closes the menu) unless this is true; the menu then gets
   * it itself (e.g. a question is not skipped).
   */
  readonly menuKeepsBackspace?: boolean;
  /** Space always goes to the menu, even after search text (multi-select lists toggle with it). */
  readonly menuKeepsSpace?: boolean;
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

/** The scroll window of the list on screen: the first one a component in the tree names. */
export function findMenuWindow(component: Component): ListWindow | undefined {
  const chrome = component as MenuChrome;
  if (typeof chrome.menuWindow === 'function') return chrome.menuWindow();
  for (const child of (component as { children?: Component[] }).children ?? []) {
    const window = findMenuWindow(child);
    if (window) return window;
  }
  return undefined;
}

/**
 * Lowercases a title's first letter unless its first word is an acronym or a name, so titles read like
 * placeholders: "Select thread" → "select thread", "API keys" and "GitHub signals" stay.
 */
export function lowerFirst<T extends string | undefined>(text: T): T {
  return (
    text && /^[A-Z][a-z]/.test(text) && !/^[A-Z][a-z]+[A-Z]/.test(text) ? text[0]!.toLowerCase() + text.slice(1) : text
  ) as T;
}
