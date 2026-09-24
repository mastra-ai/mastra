import { useEffect, useRef } from 'react';
import { TASK_GRAPH_MOTION_MS, TASK_ROW_HEIGHT } from './task-graph-node';

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const easeOutQuint = (progress: number) => 1 - (1 - progress) ** 5;

/* Scroll position is not a CSS property, so the glide is tweened to match the max-height transition. */
const glideScrollTop = (viewport: HTMLElement, top: number) => {
  const start = viewport.scrollTop;
  const distance = top - start;
  if (prefersReducedMotion()) {
    viewport.scrollTo({ top });
    return () => {};
  }
  let frame = 0;
  const startedAt = performance.now();
  const step = (now: number) => {
    const progress = Math.min((now - startedAt) / TASK_GRAPH_MOTION_MS, 1);
    viewport.scrollTo({ top: start + distance * easeOutQuint(progress) });
    if (progress < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
};

const revealedScrollTop = (rowIndex: number, currentTop: number, windowHeight: number) => {
  const rowTop = rowIndex * TASK_ROW_HEIGHT;
  const rowBottom = rowTop + TASK_ROW_HEIGHT;
  if (rowTop < currentTop) return rowTop;
  if (rowBottom > currentTop + windowHeight) return rowBottom - windowHeight;
  return currentTop;
};

interface FocusedRowScrollOptions {
  focusIndex: number;
  rowCount: number;
  windowHeight: number;
  open: boolean;
  followFocus: boolean;
}

const wantedScrollTop = (
  currentTop: number,
  { focusIndex, windowHeight, open, followFocus }: Omit<FocusedRowScrollOptions, 'rowCount'>,
) => {
  if (!open) return focusIndex * TASK_ROW_HEIGHT;
  if (!followFocus) return currentTop;
  return revealedScrollTop(focusIndex, currentTop, windowHeight);
};

const clampScrollTop = (top: number, contentHeight: number, windowHeight: number) =>
  Math.min(Math.max(top, 0), Math.max(contentHeight - windowHeight, 0));

export const useFocusedRowScroll = (options: FocusedRowScrollOptions) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const placedOnce = useRef(false);
  const { focusIndex, rowCount, windowHeight, open, followFocus } = options;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof viewport.scrollTo !== 'function') return;
    const currentTop = viewport.scrollTop;
    const contentHeight = rowCount * TASK_ROW_HEIGHT;
    const wantedTop = wantedScrollTop(currentTop, { focusIndex, windowHeight, open, followFocus });
    const top = clampScrollTop(wantedTop, contentHeight, windowHeight);
    if (!placedOnce.current) {
      placedOnce.current = true;
      viewport.scrollTo({ top });
      return;
    }
    if (top !== currentTop) return glideScrollTop(viewport, top);
  }, [focusIndex, rowCount, windowHeight, open, followFocus]);

  return viewportRef;
};
