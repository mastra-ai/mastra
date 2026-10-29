import { useEffect, useLayoutEffect, useRef } from 'react';
import { activeIndex, orderedRange } from './drag-selection-range';
import type { DragSelectionRange } from './drag-selection-range';

/** Crosshair over the plot, and no text selection of the axis labels while dragging. */
export const DRAG_SELECTION_SURFACE_CLASS = 'select-none [&_.recharts-surface]:cursor-crosshair';

type ChartMouseState = { activeTooltipIndex?: unknown } | undefined;

export type UseDragSelectionOptions = {
  /** Fires on release once a drag spans two or more points. Leave unset to turn drag selection off. */
  onSelect?: (range: DragSelectionRange) => void;
  /**
   * Fires on every drag move with the range so far (one point included), and with `undefined` on
   * release. Use it for chart-specific feedback, like dimming the columns outside the range.
   */
  onPreview?: (range: DragSelectionRange | undefined) => void;
};

export type DragSelection = {
  enabled: boolean;
  /** Spread on the chart's wrapper while enabled; `undefined` otherwise. */
  className: string | undefined;
  /** Pass to the chart's `onMouseDown`. */
  onMouseDown: (state: ChartMouseState, event?: { preventDefault(): void }) => void;
  /** Pass to the chart's `onMouseMove`, or call it first from your own handler. */
  onMouseMove: (state: ChartMouseState) => void;
  isDragging: () => boolean;
  /**
   * Call first in the chart's `onClick`: true once for the click that ends a drag, which should
   * not also click the point under the pointer.
   */
  consumeReleaseClick: () => boolean;
  /** `DragSelectionBand` registers its state setter here, so a drag re-renders the band only. */
  bandSetter: { current: (range: DragSelectionRange | undefined) => void };
};

/**
 * Drag across a Recharts chart to select a range of data indices. The drag is kept in refs and
 * pushed to `DragSelectionBand` through its setter, so a drag never re-renders the chart.
 */
export function useDragSelection({ onSelect, onPreview }: UseDragSelectionOptions): DragSelection {
  const latest = useRef({ onSelect, onPreview });
  useLayoutEffect(() => {
    latest.current = { onSelect, onPreview };
  });
  const drag = useRef<{ anchor: number; current: number }>(undefined);
  const releasedDrag = useRef(false);
  const stopListening = useRef<() => void>(undefined);
  const bandSetter = useRef<(range: DragSelectionRange | undefined) => void>(() => {});
  useEffect(() => () => stopListening.current?.(), []);

  const finish = () => {
    stopListening.current = undefined;
    const range = drag.current;
    drag.current = undefined;
    latest.current.onPreview?.(undefined);
    bandSetter.current(undefined);
    if (range && range.anchor !== range.current) {
      releasedDrag.current = true;
      latest.current.onSelect?.(orderedRange(range.anchor, range.current));
    }
  };

  const enabled = !!onSelect;
  return {
    enabled,
    className: enabled ? DRAG_SELECTION_SURFACE_CLASS : undefined,
    onMouseDown: (state, event) => {
      releasedDrag.current = false;
      if (!latest.current.onSelect) return;
      event?.preventDefault();
      const index = activeIndex(state);
      if (index === undefined) return;
      drag.current = { anchor: index, current: index };
      latest.current.onPreview?.({ start: index, end: index });
      // On the window, so a release outside the chart still ends the drag.
      window.addEventListener('mouseup', finish, { once: true });
      stopListening.current = () => window.removeEventListener('mouseup', finish);
    },
    onMouseMove: state => {
      const dragging = drag.current;
      if (!dragging) return;
      const index = activeIndex(state);
      if (index !== undefined) dragging.current = index;
      const range = orderedRange(dragging.anchor, dragging.current);
      latest.current.onPreview?.(range);
      // One point is still a click; the band appears once the drag spans two.
      bandSetter.current(range.start === range.end ? undefined : range);
    },
    isDragging: () => drag.current !== undefined,
    consumeReleaseClick: () => {
      const was = releasedDrag.current;
      releasedDrag.current = false;
      return was;
    },
    bandSetter,
  };
}
