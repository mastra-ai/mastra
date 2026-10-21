import { useEffect } from 'react';
import type { Dispatch, KeyboardEvent, SetStateAction } from 'react';

import { VIEWPORT_KEY_ACTIONS, panViewport, zoomViewport } from './timeViewport';
import type { TimeViewport } from './timeViewport';

const PINCH_SENSITIVITY = 0.01;
const WHEEL_LINE_PX = 16;
// Any wheel event left to the browser mid-swipe overscrolls the page sideways, which macOS turns into history back.
const SWIPE_IDLE_MS = 250;
// Bars and marks are links; a press on one opens it rather than dragging time.
const INTERACTIVE_TARGET = 'a, button, [tabindex]:not([data-time-track])';

function wheelPx(delta: number, event: WheelEvent): number {
  return event.deltaMode === WheelEvent.DOM_DELTA_LINE ? delta * WHEEL_LINE_PX : delta;
}

function sidewaysPx(event: WheelEvent): number {
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return wheelPx(event.deltaX, event);
  if (event.shiftKey) return wheelPx(event.deltaY, event);
  return 0;
}

export function useTimeGestures(
  { chart, track }: { chart: HTMLElement | null; track: HTMLElement | null },
  setViewport: Dispatch<SetStateAction<TimeViewport>>,
) {
  useEffect(() => {
    if (chart === null || track === null) return;
    let dragLastX: number | undefined;
    let swipeEndsAt = 0;

    const onWheel = (event: WheelEvent) => {
      // A trackpad pinch arrives as a ctrl-wheel; unhandled, the browser zooms the whole page.
      const pinching = event.ctrlKey;
      const sideways = sidewaysPx(event);
      const midSwipe = event.timeStamp < swipeEndsAt;
      const movesTime = pinching || sideways !== 0 || midSwipe;
      if (!movesTime) return;
      const trackRect = track.getBoundingClientRect();
      if (trackRect.width === 0) return;
      event.preventDefault();
      if (pinching) {
        const anchorFraction = Math.min(1, Math.max(0, (event.clientX - trackRect.left) / trackRect.width));
        const scale = Math.exp(wheelPx(event.deltaY, event) * PINCH_SENSITIVITY);
        setViewport(current => zoomViewport(current, scale, anchorFraction, Date.now()));
        return;
      }
      swipeEndsAt = event.timeStamp + SWIPE_IDLE_MS;
      const deltaPx = sideways === 0 ? wheelPx(event.deltaX, event) : sideways;
      if (deltaPx !== 0) setViewport(current => panViewport(current, deltaPx / trackRect.width, Date.now()));
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return;
      if (event.target.closest(INTERACTIVE_TARGET)) return;
      dragLastX = event.clientX;
      track.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (dragLastX === undefined) return;
      const deltaPx = dragLastX - event.clientX;
      dragLastX = event.clientX;
      if (deltaPx === 0) return;
      const { width } = track.getBoundingClientRect();
      if (width > 0) setViewport(current => panViewport(current, deltaPx / width, Date.now()));
    };
    const endDrag = () => {
      dragLastX = undefined;
    };

    chart.addEventListener('wheel', onWheel, { passive: false });
    track.addEventListener('pointerdown', onPointerDown);
    track.addEventListener('pointermove', onPointerMove);
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    return () => {
      chart.removeEventListener('wheel', onWheel);
      track.removeEventListener('pointerdown', onPointerDown);
      track.removeEventListener('pointermove', onPointerMove);
      track.removeEventListener('pointerup', endDrag);
      track.removeEventListener('pointercancel', endDrag);
    };
  }, [chart, track, setViewport]);
}

export function timeKeyHandler(setViewport: Dispatch<SetStateAction<TimeViewport>>) {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    const action = VIEWPORT_KEY_ACTIONS[event.key];
    if (action === undefined) return;
    event.preventDefault();
    setViewport(current => action(current, Date.now()));
  };
}
