type Point = { x: number; y: number };

const CURSOR_GAP = 20;
const VIEWPORT_GAP = 12;
const FOLLOW_TIME_MS = 80;

/** A single frame loop moves the overlay; cursor movement never enters React state. */
export function createKnowledgeHoverFollower(element: HTMLElement) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let cursor: Point = { x: 0, y: 0 };
  let position: Point | undefined;
  let size = { width: 0, height: 0 };
  let frame: number | undefined;
  let lastTime: number | undefined;
  let snapNextResize = false;

  function destination(): Point {
    const { width, height } = size;
    const availableWidth = window.innerWidth - VIEWPORT_GAP;
    const availableHeight = window.innerHeight - VIEWPORT_GAP;
    const x = cursor.x + CURSOR_GAP + width <= availableWidth ? cursor.x + CURSOR_GAP : cursor.x - width - CURSOR_GAP;
    const y =
      cursor.y + CURSOR_GAP + height <= availableHeight ? cursor.y + CURSOR_GAP : cursor.y - height - CURSOR_GAP;
    return {
      x: Math.max(VIEWPORT_GAP, Math.min(x, availableWidth - width)),
      y: Math.max(VIEWPORT_GAP, Math.min(y, availableHeight - height)),
    };
  }

  function paint(point: Point) {
    position = point;
    element.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
  }

  function tick(now: number) {
    frame = undefined;
    snapNextResize = false;
    const target = destination();
    if (!position || reducedMotion.matches) {
      paint(target);
      lastTime = undefined;
      return;
    }
    const elapsed = lastTime === undefined ? 16 : Math.min(now - lastTime, 64);
    const progress = 1 - Math.exp(-elapsed / FOLLOW_TIME_MS);
    const next = {
      x: position.x + (target.x - position.x) * progress,
      y: position.y + (target.y - position.y) * progress,
    };
    lastTime = now;
    if (Math.hypot(target.x - next.x, target.y - next.y) < 0.25) {
      paint(target);
      lastTime = undefined;
      return;
    }
    paint(next);
    frame = requestAnimationFrame(tick);
  }

  function schedule() {
    if (frame === undefined) frame = requestAnimationFrame(tick);
  }

  return {
    move(point: Point, reset = false) {
      cursor = point;
      snapNextResize = reset;
      if (reset || reducedMotion.matches) paint(destination());
      schedule();
    },
    resize(width: number, height: number) {
      size = { width, height };
      if (snapNextResize || reducedMotion.matches) paint(destination());
      snapNextResize = false;
      schedule();
    },
    stop() {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      lastTime = undefined;
    },
  };
}
