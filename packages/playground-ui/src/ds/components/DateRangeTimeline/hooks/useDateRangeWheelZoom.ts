import { useEffect, useEffectEvent } from 'react';
import type { RefObject } from 'react';
import { clamp } from '../lib/date-range-timeline';

const MAX_WHEEL_DELTA = 80;
const WHEEL_ZOOM_SENSITIVITY = 0.003;

interface UseDateRangeWheelZoomInput {
  rootRef: RefObject<HTMLDivElement | null>;
  trackRef: RefObject<HTMLDivElement | null>;
  disabled: boolean;
  onZoom: (factor: number, anchor: number) => void;
}

export function useDateRangeWheelZoom({ rootRef, trackRef, disabled, onZoom }: UseDateRangeWheelZoomInput) {
  const handleWheel = useEffectEvent((event: WheelEvent) => {
    if (!event.ctrlKey) return;
    // Bail before preventDefault when disabled so native browser zoom still works.
    if (disabled) return;
    event.preventDefault();

    const trackRect = trackRef.current?.getBoundingClientRect();
    const anchor =
      trackRect && trackRect.width > 0 ? clamp((event.clientX - trackRect.left) / trackRect.width, 0, 1) : 0.5;
    const wheelDelta = clamp(event.deltaY, -MAX_WHEEL_DELTA, MAX_WHEEL_DELTA);
    const factor = Math.exp(wheelDelta * WHEEL_ZOOM_SENSITIVITY);
    onZoom(factor, anchor);
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.addEventListener('wheel', handleWheel, { passive: false });
    return () => root.removeEventListener('wheel', handleWheel);
  }, [rootRef]);
}
