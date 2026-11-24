import { useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

export type RowDrag = { from: number; to: number; offset: number };

const middleOf = (row: DOMRect) => row.top + row.height / 2;

function swallow(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}

/**
 * Drag-to-reorder for the rows of a list, started from an element marked `data-grip` inside a row. The dragged row
 * only travels up and down, kept between rows `min` and `max`, and Escape puts it back. Alt+Up and Alt+Down on a row
 * move it one place, for keyboards.
 */
export function useRowDrag({
  min,
  max,
  onDrop,
}: {
  min: number;
  max: number;
  onDrop: (from: number, to: number) => void;
}) {
  const [drag, setDrag] = useState<RowDrag>();

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    const to = index + (event.key === 'ArrowUp' ? -1 : 1);
    if (to >= min && to <= max) onDrop(index, to);
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>, from: number) => {
    if (event.button !== 0 || !(event.target instanceof Element) || !event.target.closest('[data-grip]')) return;
    const list = event.currentTarget.parentElement;
    if (!list) return;
    event.preventDefault();
    const rows = Array.from(list.children, row => row.getBoundingClientRect());
    const startY = event.clientY;
    let current: RowDrag | undefined;

    const onMove = (move: globalThis.PointerEvent) => {
      const raw = move.clientY - startY;
      if (!current && Math.abs(raw) < 4) return;
      const self = rows[from];
      const first = rows[min];
      const last = rows[max];
      if (!self || !first || !last) return;
      // Bounded by the end rows' middles, not their edges, so a tall row can still pass a short one at either end.
      const offset = Math.min(Math.max(raw, middleOf(first) - middleOf(self)), middleOf(last) - middleOf(self));
      const center = middleOf(self) + offset;
      let to = from;
      rows.forEach((row, index) => {
        const middle = middleOf(row);
        if (index > from && index <= max && center >= middle) to = index;
        if (index >= min && index < from && center <= middle) to = Math.min(to, index);
      });
      current = { from, to, offset };
      setDrag(current);
    };
    const stop = (drop: boolean) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onEscape);
      if (current) {
        window.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => window.removeEventListener('click', swallow, { capture: true }));
        if (drop && current.to !== current.from) onDrop(current.from, current.to);
      }
      setDrag(undefined);
    };
    const onUp = () => stop(true);
    const onCancel = () => stop(false);
    const onEscape = (key: globalThis.KeyboardEvent) => {
      if (key.key === 'Escape') {
        key.preventDefault();
        stop(false);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onEscape);
  };

  /** Where the dragged row will land: before or after the row it takes the place of. */
  const dropAt = (index: number) =>
    drag && drag.to !== drag.from && drag.to === index ? (drag.to < drag.from ? 'before' : 'after') : undefined;

  return { drag, dropAt, onKeyDown, onPointerDown };
}
