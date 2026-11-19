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

/**
 * Hands a click anywhere else in an inset row to the row's `Table.RowLink` or `Table.RowButton`,
 * as the same click (button and modifier keys included), so Cmd-click and middle-click on a link
 * open a new tab. The row target is a real `a` or `button`, so the browser and any router keep
 * their own handling; no overlay is stretched over the row.
 */
export function forwardRowClick(event: MouseEvent<HTMLTableRowElement>) {
  const row = event.currentTarget;
  const target = event.target;
  if (event.defaultPrevented || !(target instanceof Element) || !row.contains(target)) return;
  if (event.type === 'click' ? event.button !== 0 : event.button !== 1) return;

  const rowTarget = row.querySelector<HTMLElement>('[data-row-target]');
  if (!rowTarget) return;
  if (event.type === 'auxclick' && rowTarget.tagName !== 'A') return;

  const control = target.closest(ROW_CONTROLS);
  if (control && control !== row && row.contains(control)) return;
  if (row.ownerDocument.getSelection()?.toString()) return;

  const RowMouseEvent = row.ownerDocument.defaultView?.MouseEvent ?? globalThis.MouseEvent;
  rowTarget.dispatchEvent(
    new RowMouseEvent('click', {
      bubbles: true,
      cancelable: true,
      detail: event.detail,
      button: event.button,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
    }),
  );
}
