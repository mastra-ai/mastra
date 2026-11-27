import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';

import { glideTiming } from './glide-timing';

export type RowDrag = { from: number; to: number; offset: number };

/** A drag with the rows' places on screen as it started, and the canvas zoom they were measured under. */
type Drag = RowDrag & { rows: DOMRect[]; zoom: number };

/** Where each row stood on screen as a drag ended, so the rows can glide from there into their places. */
type Settle = { rows: { row: Element; top: number }[]; dragged: Element | undefined; zoom: number };

/** Rows easing out of the dragged row's way while it travels. */
const MAKING_WAY = 'duration-normal ease-out-custom transition-transform motion-reduce:transition-none';

const middleOf = (row: DOMRect) => row.top + row.height / 2;

function swallow(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}

/** How far a row steps out of the dragged row's way: the dragged row's height and the gap after it, up or down. */
function shiftOf({ from, to, rows }: Drag, index: number) {
  const self = rows[from];
  if (!self) return 0;
  if (index > from && index <= to) return self.top - (rows[from + 1]?.top ?? self.top);
  if (index >= to && index < from) return self.bottom - (rows[from - 1]?.bottom ?? self.bottom);
  return 0;
}

/** Eases every row from where it stood as the drag ended into where it stands now, so a drop or Escape never snaps. */
function glide({ rows, dragged, zoom }: Settle): Animation[] {
  const timing = glideTiming();
  if (!timing) return [];
  return rows.flatMap(({ row, top }) => {
    // Screen pixels, under the canvas zoom; a transform inside the zoom is scaled by it.
    const delta = (top - row.getBoundingClientRect().top) / zoom;
    if (!row.isConnected || Math.abs(delta) < 0.5) return [];
    // The dropped row stays over the rows it passes on its way into place.
    const lift = row === dragged ? { zIndex: ['10', '10'] } : {};
    return [row.animate({ transform: [`translateY(${delta}px)`, 'none'], ...lift }, timing)];
  });
}

/**
 * Drag-to-reorder for the rows of a list, started from an element marked `data-grip` inside a row. A button or field
 * inside the grip keeps its own press, so a whole card can be the grip and still hold a menu. The dragged row only
 * travels up and down with the pointer, kept between rows `min` and `max`; the rows it passes step out of its way as
 * it goes, so the list always shows the order a drop would make. A drop glides the row into its place, and Escape
 * glides every row back. Alt+Up and Alt+Down on a row move it one place, for keyboards.
 *
 * Spread `rowMotion(index)` on each row: it carries the row's transform while a drag is on.
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
  const [drag, setDrag] = useState<Drag>();
  const settle = useRef<Settle>(undefined);
  const gliding = useRef<Animation[]>([]);

  // Runs once the drop's new order is on the page and before it paints, to start the rows from where they stood.
  useLayoutEffect(() => {
    const ended = settle.current;
    if (!ended) return;
    settle.current = undefined;
    gliding.current = glide(ended);
  });

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    const to = index + (event.key === 'ArrowUp' ? -1 : 1);
    if (to >= min && to <= max) onDrop(index, to);
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>, from: number) => {
    if (event.button !== 0 || !(event.target instanceof Element)) return;
    const grip = event.target.closest('[data-grip]');
    const control = event.target.closest('button, input, select, textarea');
    if (!grip || (control && grip.contains(control))) return;
    const list = event.currentTarget.parentElement;
    if (!list) return;
    event.preventDefault();
    // Rows still gliding from the last drop are measured where they end up.
    for (const animation of gliding.current) animation.finish();
    gliding.current = [];
    const rows = Array.from(list.children, row => row.getBoundingClientRect());
    const zoom = list.currentCSSZoom || 1;
    const startY = event.clientY;
    let current: Drag | undefined;

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
      current = { from, to, offset, rows, zoom };
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
        settle.current = {
          rows: Array.from(list.children, row => ({ row, top: row.getBoundingClientRect().top })),
          dragged: list.children[from],
          zoom,
        };
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

  /**
   * The row's place while a drag is on: the dragged row follows the pointer, raised over the rest, and the rows it
   * passed ease out of its way. Nothing once the drag ends, when the rows stand in their new order.
   */
  const rowMotion = (index: number): { style?: CSSProperties; className?: string } => {
    if (!drag) return {};
    if (index === drag.from) {
      return { style: { transform: `translateY(${drag.offset / drag.zoom}px)` }, className: 'z-10' };
    }
    return { style: { transform: `translateY(${shiftOf(drag, index) / drag.zoom}px)` }, className: MAKING_WAY };
  };

  return { drag, rowMotion, onKeyDown, onPointerDown };
}
