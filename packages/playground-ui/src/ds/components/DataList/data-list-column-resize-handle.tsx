import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useDataListReorder } from './data-list-reorder-context';
import { useDataListResize } from './data-list-resize-context';
import { splitColumns } from './shared';
import { ResizeHandleIndicator } from '@/ds/primitives/resize-handle-indicator';
import { cn } from '@/lib/utils';

const KEYBOARD_STEP = 16;
const KEYBOARD_STEP_LARGE = 64;

/** Original column index of a header cell, or `null` when it is not in a full-width cells container. */
function getOriginalIndex(cell: HTMLElement): number | null {
  const parent = cell.parentElement;
  if (!parent?.classList.contains('data-list-cells')) return null;
  return Array.from(parent.children).indexOf(cell);
}

/** Current rendered width of the header cell's column, in px. */
function measureColumn(cell: HTMLElement, original: number, order: number[]): number {
  const visual = order.length > 0 ? order.indexOf(original) : original;
  const grid = cell.closest('.data-list-grid');
  if (grid && visual !== -1) {
    const resolved = Number.parseFloat(splitColumns(getComputedStyle(grid).gridTemplateColumns)[visual] ?? '');
    if (Number.isFinite(resolved)) return resolved;
  }
  return cell.getBoundingClientRect().width;
}

/**
 * Resize grip rendered at the end edge of a header cell by `DataListTopCell`
 * when the list is `resizable`. It is hidden unless the cell sits directly in a
 * full-width `.data-list-cells` group, where columns map 1:1 to grid tracks.
 */
export function DataListColumnResizeHandle() {
  const { setWidth, resetWidth } = useDataListResize();
  const { order } = useDataListReorder();
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupRef.current?.(), []);

  const getCell = (handle: HTMLElement) => handle.parentElement;

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      const handle = event.currentTarget;
      const cell = getCell(handle);
      if (!cell) return;
      const original = getOriginalIndex(cell);
      if (original === null) return;

      event.preventDefault();
      event.stopPropagation();
      try {
        handle.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best effort; window listeners below still track the drag.
      }

      cleanupRef.current?.();
      const startX = event.clientX;
      const startWidth = measureColumn(cell, original, order);
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      handle.dataset.resizing = 'true';

      const onMove = (moveEvent: globalThis.PointerEvent) => {
        setWidth(original, startWidth + moveEvent.clientX - startX);
      };
      const stop = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', stop);
        window.removeEventListener('pointercancel', stop);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        delete handle.dataset.resizing;
        cleanupRef.current = null;
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', stop);
      window.addEventListener('pointercancel', stop);
      cleanupRef.current = stop;
    },
    [order, setWidth],
  );

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const cell = getCell(event.currentTarget);
    if (!cell) return;
    const original = getOriginalIndex(cell);
    if (original === null) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? KEYBOARD_STEP_LARGE : KEYBOARD_STEP;
    const delta = event.key === 'ArrowLeft' ? -step : step;
    setWidth(original, measureColumn(cell, original, order) + delta);
  };

  const onDoubleClick = (event: MouseEvent<HTMLElement>) => {
    const cell = getCell(event.currentTarget);
    const original = cell ? getOriginalIndex(cell) : null;
    if (original === null) return;
    event.preventDefault();
    event.stopPropagation();
    resetWidth(original);
  };

  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize column"
      tabIndex={0}
      data-data-list-resize-handle=""
      className={cn(
        'group/resize absolute inset-y-0 right-0 z-10 w-2 cursor-col-resize touch-none items-center justify-center focus-visible:outline-hidden',
        'hidden [.data-list-cells>*>&]:flex',
      )}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={onDoubleClick}
      onClick={event => event.stopPropagation()}
    >
      <ResizeHandleIndicator className="group-hover/resize:opacity-100 group-focus-visible/resize:opacity-100 group-data-[resizing=true]/resize:opacity-100" />
    </span>
  );
}
