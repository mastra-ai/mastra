import { useEffect, useRef } from 'react';
import type { PointerEvent, RefObject } from 'react';
import { useTraceTimeCursorStore } from './use-trace-time-cursor';

/** The trace's time range on the axis: `startMs` epoch ms, `latency` ms long. */
export type TimelineRange = { startMs: number; latency: number };

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Pointer handlers that move the cursor along `trackRef`, the element spanning the axis track.
 * - `seek` (the axis): pressing jumps the cursor to the pointer.
 * - `grab` (the playhead): pressing picks the cursor up where it is, so it doesn't jump
 *   by the few pixels between the pointer and the playhead's center.
 *
 * Moves are batched to one store update per frame. They read the store without subscribing,
 * so the component using them never re-renders as the cursor moves.
 */
export function useTimelineScrub(
  trackRef: RefObject<HTMLElement | null>,
  range: TimelineRange,
  mode: 'seek' | 'grab' = 'seek',
) {
  const store = useTraceTimeCursorStore();
  const frame = useRef<number>(undefined);
  const grabOffset = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current ?? 0), []);

  if (!store || !range.latency) return {};

  const timeAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect?.width) return range.startMs;
    return range.startMs + clamp((clientX - rect.left) / rect.width, 0, 1) * range.latency;
  };

  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      if (mode === 'grab') {
        const rect = event.currentTarget.getBoundingClientRect();
        grabOffset.current = rect.left + rect.width / 2 - event.clientX;
        // A grab on the "Full trace" playhead pins the cursor to the end before it moves.
        if (store.get() == null) store.set(range.startMs + range.latency);
        return;
      }
      grabOffset.current = 0;
      store.set(timeAt(event.clientX));
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) return;
      const t = timeAt(event.clientX + grabOffset.current);
      cancelAnimationFrame(frame.current ?? 0);
      frame.current = requestAnimationFrame(() => store.set(t));
    },
  };
}
