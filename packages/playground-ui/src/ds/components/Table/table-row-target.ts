import type { MouseEvent } from 'react';
import type { TableVariant } from './table-context';

const rowTargetStyles = ['outline-none'];

export function tableRowTargetStyles(variant: TableVariant) {
  if (variant === 'inset') return rowTargetStyles;
  return [];
}

// Things in a row that take their own clicks.
const ROW_CONTROLS = [
  'a[href],button,input,select,textarea,label,summary,[contenteditable]:not([contenteditable="false"])',
  '[role="button"],[role="link"],[role="checkbox"],[role="switch"],[role="menuitem"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// The clicks the row hands on, so the row skips them when they bubble back up.
const forwarded = new WeakSet<Event>();

export function isForwardedRowClick(event: MouseEvent<HTMLTableRowElement>) {
  return forwarded.has(event.nativeEvent);
}

/**
 * Hands a plain click elsewhere in an inset row to its `Table.RowLink` or `Table.RowButton`, a real
 * `a` or `button`, instead of stretching an overlay over the row. Modified and middle clicks are
 * left alone, since browsers open no new tab for a click a script makes.
 */
export function forwardRowClick(event: MouseEvent<HTMLTableRowElement>) {
  const row = event.currentTarget;
  const target = event.target as Element;
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return;
  if (!row.contains(target) || row.ownerDocument.getSelection()?.toString()) return;
  const control = target.closest(ROW_CONTROLS);
  if (control && control !== row && row.contains(control)) return;
  const rowTarget = row.querySelector<HTMLElement>('[data-row-target]');
  if (!rowTarget) return;
  const mark = (click: Event) => forwarded.add(click);
  rowTarget.addEventListener('click', mark, { capture: true });
  try {
    rowTarget.click();
  } finally {
    rowTarget.removeEventListener('click', mark, { capture: true });
  }
}
