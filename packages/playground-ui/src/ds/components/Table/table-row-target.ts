import type { MouseEvent } from 'react';
import type { TableVariant } from './table-context';

const rowTargetStyles = ['outline-none'];

export function tableRowTargetStyles(variant: TableVariant) {
  if (variant === 'inset') return rowTargetStyles;
  return [];
}

// Anything in a row that handles its own clicks; the row leaves those alone.
const ROW_CONTROLS = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'summary',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="menuitem"]',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// Clicks the row made itself; the row lets them through untouched when they bubble back up.
const forwardedClicks = new WeakSet<Event>();

export function isForwardedRowClick(event: MouseEvent<HTMLTableRowElement>) {
  return forwardedClicks.has(event.nativeEvent);
}

/**
 * Hands a plain primary click anywhere else in an inset row to the row's `Table.RowLink` or
 * `Table.RowButton`. The row target is a real `a` or `button`, so the browser and any router keep
 * their own handling; no overlay is stretched over the row. Modified and middle clicks are left
 * alone: browsers open no new tab for a click a script dispatches, so Cmd-click, Ctrl-click,
 * Shift-click and middle-click work on the link itself only.
 */
export function forwardRowClick(event: MouseEvent<HTMLTableRowElement>) {
  const row = event.currentTarget;
  const target = event.target;
  if (event.defaultPrevented || isForwardedRowClick(event)) return;
  if (!(target instanceof Element) || !row.contains(target)) return;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const rowTarget = row.querySelector<HTMLElement>('[data-row-target]');
  if (!rowTarget) return;

  const control = target.closest(ROW_CONTROLS);
  if (control && control !== row && row.contains(control)) return;
  if (row.ownerDocument.getSelection()?.toString()) return;

  const RowMouseEvent = row.ownerDocument.defaultView?.MouseEvent ?? globalThis.MouseEvent;
  const click = new RowMouseEvent('click', { bubbles: true, cancelable: true, detail: event.detail });
  forwardedClicks.add(click);
  rowTarget.dispatchEvent(click);
}
