import { VISIBILITY_EPSILON } from './message-scroller-geometry';

/** One designed curve for the one scripted trip: fast liftoff, long settle. */
const TRIP_MS = 560;
/** How long past its clock a trip may chase a destination the layout hasn't released yet. */
const TRIP_OVERTIME_MS = 240;

const easeOutQuint = (t: number) => 1 - (1 - t) ** 5;

export type TripEndReason = 'arrived' | 'interrupted' | 'expired';

export interface TripAnimation {
  cancel: () => void;
}

/**
 * Drives the viewport to a destination the way a transition would, not the way
 * `scrollTo({ behavior: 'smooth' })` does: the destination is re-read every frame,
 * so a layout still settling under the trip — the reserved room opening beneath a
 * new turn — bends the path instead of restarting the curve. Writes are clamped by
 * the browser, so until the room has opened far enough the trip simply rides the
 * end of the box down.
 *
 * The reader keeps the last word: a scroll position this trip didn't write ends it.
 */
export function startTrip(
  viewportElement: HTMLElement,
  getTarget: () => number | undefined,
  onEnd: (reason: TripEndReason) => void,
): TripAnimation {
  const reduceMotion =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reduceMotion ? 0 : TRIP_MS;
  const startedAt = performance.now();
  const from = viewportElement.scrollTop;
  let lastWritten = from;
  let frame = 0;
  let ended = false;

  const end = (reason: TripEndReason) => {
    ended = true;
    onEnd(reason);
  };

  const step = () => {
    if (Math.abs(viewportElement.scrollTop - lastWritten) > 1) return end('interrupted');
    const target = getTarget();
    if (target === undefined) return end('expired');
    const elapsed = performance.now() - startedAt;
    const progress = duration === 0 ? 1 : Math.min(1, elapsed / duration);
    viewportElement.scrollTop = from + (target - from) * easeOutQuint(progress);
    lastWritten = viewportElement.scrollTop;
    if (progress === 1 && Math.abs(lastWritten - target) <= VISIBILITY_EPSILON) return end('arrived');
    if (elapsed >= duration + TRIP_OVERTIME_MS) return end('expired');
    frame = window.requestAnimationFrame(step);
  };

  frame = window.requestAnimationFrame(step);

  return {
    cancel: () => {
      if (ended) return;
      ended = true;
      window.cancelAnimationFrame(frame);
    },
  };
}
