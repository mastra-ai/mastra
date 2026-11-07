/**
 * Routes a click to the component under it by walking the component tree the
 * same way it renders: Box padding is subtracted, Container children are
 * stacked by rendered height. Rows and columns are 0-based and local to the
 * component being visited.
 */
import { Box, Container, SelectList, Text } from '@earendil-works/pi-tui';
import type { Component } from '@earendil-works/pi-tui';

import { boxPadding, selectListInternals } from './pi-tui-internals.js';
import type { TerminalMouseEvent } from './sgr.js';

export interface MouseClick {
  event: TerminalMouseEvent;
  row: number;
  col: number;
  width: number;
}

/** Components that resolve clicks themselves. Return true when the click was handled. */
export interface MouseAware {
  handleMouse(click: MouseClick): boolean;
}

export function isMouseAware(component: unknown): component is MouseAware {
  return typeof (component as Partial<MouseAware> | null)?.handleMouse === 'function';
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

  handleMouse(): boolean {
    this.onClick();
    return true;
  }
}

export function dispatchClick(component: Component, click: MouseClick): boolean {
  if (click.row < 0 || click.col < 0 || click.col >= click.width) return false;
  if (isMouseAware(component)) return component.handleMouse(click);
  if (component instanceof SelectList) return clickSelectList(component, click.row);

  if (component instanceof Box) {
    const { paddingX, paddingY } = boxPadding(component);
    return dispatchStacked(component.children, {
      ...click,
      row: click.row - paddingY,
      col: click.col - paddingX,
      width: Math.max(1, click.width - paddingX * 2),
    });
  }
  if (component instanceof Container) return dispatchStacked(component.children, click);
  return false;
}

function dispatchStacked(children: Component[], click: MouseClick): boolean {
  let top = 0;
  for (const child of children) {
    const height = child.render(click.width).length;
    if (click.row < top + height) return dispatchClick(child, { ...click, row: click.row - top });
    top += height;
  }
  return false;
}

/** Mirrors SelectList.render's scroll window: one row per visible item, then an optional scroll line. */
function clickSelectList(list: SelectList, row: number): boolean {
  const { filteredItems, selectedIndex, maxVisible } = selectListInternals(list);
  const startIndex = Math.max(
    0,
    Math.min(selectedIndex - Math.floor(maxVisible / 2), filteredItems.length - maxVisible),
  );
  const endIndex = Math.min(startIndex + maxVisible, filteredItems.length);
  const index = startIndex + row;
  if (index >= endIndex) return false;

  list.setSelectedIndex(index);
  const item = filteredItems[index];
  if (item) list.onSelect?.(item);
  return true;
}
