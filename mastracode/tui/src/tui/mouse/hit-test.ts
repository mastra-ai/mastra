/**
 * Finds the component under a point by walking the component tree the same
 * way it renders: Box padding is subtracted, Container children are stacked
 * by rendered height. Rows and columns are 0-based and local to the component
 * being visited.
 *
 * Clicks activate the target (like Enter). Hover only draws a marker over the
 * target's rows, so it shows exactly what a click at that spot would pick
 * without changing the selection.
 */
import { Box, Container, SelectList, SettingsList, Text } from '@earendil-works/pi-tui';
import type { Component } from '@earendil-works/pi-tui';

import { boxPadding, selectListInternals, settingsListInternals } from './pi-tui-internals.js';

export interface MousePoint {
  row: number;
  col: number;
  width: number;
}

/** What sits under a point: the rows it occupies (local to the visited component) and its click action. */
export interface MouseTarget {
  top: number;
  height: number;
  activate(): void;
}

/** Components that resolve pointer positions themselves. */
export interface MouseAware {
  mouseTarget(point: MousePoint): MouseTarget | undefined;
}

export function isMouseAware(component: unknown): component is MouseAware {
  return typeof (component as Partial<MouseAware> | null)?.mouseTarget === 'function';
}

/** A Text row that runs `onClick` when any of its wrapped lines is clicked. */
export class ClickableText extends Text implements MouseAware {
  constructor(
    text: string,
    public onClick: () => void,
    paddingX = 0,
    paddingY = 0,
  ) {
    super(text, paddingX, paddingY);
  }

  mouseTarget(point: MousePoint): MouseTarget {
    return { top: 0, height: this.render(point.width).length, activate: () => this.onClick() };
  }
}

export function locate(component: Component, point: MousePoint): MouseTarget | undefined {
  if (point.row < 0 || point.col < 0 || point.col >= point.width) return undefined;
  if (isMouseAware(component)) return component.mouseTarget(point);
  if (component instanceof SelectList) return selectListTarget(component, point.row);
  if (component instanceof SettingsList) return settingsListTarget(component, point);

  if (component instanceof Box) {
    const { paddingX, paddingY } = boxPadding(component);
    const inner = locateStacked(component.children, {
      row: point.row - paddingY,
      col: point.col - paddingX,
      width: Math.max(1, point.width - paddingX * 2),
    });
    return inner && { ...inner, top: inner.top + paddingY };
  }
  if (component instanceof Container) return locateStacked(component.children, point);
  return undefined;
}

function locateStacked(children: Component[], point: MousePoint): MouseTarget | undefined {
  let top = 0;
  for (const child of children) {
    const height = child.render(point.width).length;
    if (point.row < top + height) {
      const inner = locate(child, { ...point, row: point.row - top });
      return inner && { ...inner, top: inner.top + top };
    }
    top += height;
  }
  return undefined;
}

/** Mirrors SelectList.render's scroll window: one row per visible item, then an optional scroll line. */
function selectListTarget(list: SelectList, row: number): MouseTarget | undefined {
  const { filteredItems, selectedIndex, maxVisible } = selectListInternals(list);
  const startIndex = Math.max(
    0,
    Math.min(selectedIndex - Math.floor(maxVisible / 2), filteredItems.length - maxVisible),
  );
  const endIndex = Math.min(startIndex + maxVisible, filteredItems.length);
  const index = startIndex + row;
  const item = filteredItems[index];
  if (index >= endIndex || !item) return undefined;

  return {
    top: row,
    height: 1,
    activate: () => {
      list.setSelectedIndex(index);
      list.onSelect?.(item);
    },
  };
}

/**
 * Mirrors SettingsList.render: an open submenu replaces the list; otherwise an optional search box
 * and blank row, then one row per visible setting. Clicks act like Enter (open submenu or cycle value).
 */
function settingsListTarget(list: SettingsList, point: MousePoint): MouseTarget | undefined {
  const internals = settingsListInternals(list);
  if (internals.submenuComponent) return locate(internals.submenuComponent, point);

  const searchRows =
    internals.searchEnabled && internals.searchInput ? internals.searchInput.render(point.width).length + 1 : 0;
  const displayItems = internals.searchEnabled ? internals.filteredItems : internals.items;
  const { selectedIndex, maxVisible } = internals;
  const startIndex = Math.max(
    0,
    Math.min(selectedIndex - Math.floor(maxVisible / 2), displayItems.length - maxVisible),
  );
  const endIndex = Math.min(startIndex + maxVisible, displayItems.length);
  const row = point.row - searchRows;
  const index = startIndex + row;
  if (row < 0 || index >= endIndex || !displayItems[index]) return undefined;

  return {
    top: point.row,
    height: 1,
    activate: () => {
      internals.selectedIndex = index;
      internals.activateItem();
    },
  };
}
