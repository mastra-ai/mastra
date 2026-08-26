/** Longest single growth worth smoothing. Past it the move is one the reader asked for. */
const GLIDE_MAX = 240;
const GLIDE_MS = 220;
const GLIDE_EASE = 'cubic-bezier(0.33, 1, 0.68, 1)';

function currentOffset(element: HTMLElement): number {
  if (typeof DOMMatrixReadOnly === 'undefined') return 0;
  const { transform } = getComputedStyle(element);
  if (!transform || transform === 'none') return 0;
  return new DOMMatrixReadOnly(transform).m42;
}

const travels = new WeakMap<HTMLElement, AbortController>();

function release(element: HTMLElement): void {
  travels.get(element)?.abort();
  travels.delete(element);
  element.style.transition = '';
  element.style.transform = '';
}

function calm(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Hides a scroll that has already happened. The end is pinned instantly, as it must
 * be, then the content is put back where the reader last saw it and travels to zero
 * on the compositor — so a reply growing a line at a time reads as one movement
 * rather than a snap per wrapped line.
 *
 * Transform, not layout: `scrollHeight` never changes, so nothing here can feed the
 * resize that called it. A line landing mid-travel only adds to the distance left.
 */
export function glideContent(element: HTMLElement | null, delta: number): void {
  if (!element || delta <= 0 || calm()) return;

  const offset = currentOffset(element) + delta;
  if (offset > GLIDE_MAX) {
    release(element);
    return;
  }

  element.style.transition = 'none';
  element.style.transform = `translateY(${offset}px)`;
  // Commit the displaced position, or the browser only ever sees the settled one.
  void element.offsetHeight;
  element.style.transition = `transform ${GLIDE_MS}ms ${GLIDE_EASE}`;
  element.style.transform = 'translateY(0)';
  // A settled transform would leave the content a containing block for anything
  // fixed inside it, so the styles come off once the travel is spent. Descendants'
  // transitions bubble here too, so only the content's own settle counts.
  travels.get(element)?.abort();
  const travel = new AbortController();
  travels.set(element, travel);
  const settle = (event: TransitionEvent) => {
    if (event.target !== element) return;
    if (currentOffset(element) === 0) release(element);
  };
  element.addEventListener('transitionend', settle, { signal: travel.signal });
  element.addEventListener('transitioncancel', settle, { signal: travel.signal });
}
