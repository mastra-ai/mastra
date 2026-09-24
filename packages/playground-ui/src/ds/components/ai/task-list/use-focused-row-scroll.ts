import { useEffect, useEffectEvent, useRef } from 'react';
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

const EXPANDED_VISIBLE_ROWS = 4.5;

export const taskWindowHeight = (rowCount: number, open: boolean) =>
  open ? Math.min(rowCount, EXPANDED_VISIBLE_ROWS) * TASK_ROW_HEIGHT : TASK_ROW_HEIGHT;

interface ScrollTarget {
  focusIndex: number;
  windowHeight: number;
  open: boolean;
  followFocus: boolean;
}

const wantedScrollTop = (currentTop: number, { focusIndex, windowHeight, open, followFocus }: ScrollTarget) => {
  if (!open) return focusIndex * TASK_ROW_HEIGHT;
  if (!followFocus) return currentTop;
  return revealedScrollTop(focusIndex, currentTop, windowHeight);
};

const clampScrollTop = (top: number, contentHeight: number, windowHeight: number) =>
  Math.min(Math.max(top, 0), Math.max(contentHeight - windowHeight, 0));

interface FocusedRowScrollOptions {
  focusIndex: number;
  rowCount: number;
  open: boolean;
  followFocus: boolean;
}

export const useFocusedRowScroll = ({ focusIndex, rowCount, open, followFocus }: FocusedRowScrollOptions) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const cancelGlide = useRef<() => void>(undefined);
  const placedOnce = useRef(false);

  const glideForOpen = (nextOpen: boolean) => {
    const viewport = viewportRef.current;
    if (!viewport || typeof viewport.scrollTo !== 'function') return;
    const windowHeight = taskWindowHeight(rowCount, nextOpen);
    const wantedTop = wantedScrollTop(viewport.scrollTop, { focusIndex, windowHeight, open: nextOpen, followFocus });
    const top = clampScrollTop(wantedTop, rowCount * TASK_ROW_HEIGHT, windowHeight);
    cancelGlide.current?.();
    if (!placedOnce.current) {
      placedOnce.current = true;
      viewport.scrollTo({ top });
      return;
    }
    if (top !== viewport.scrollTop) cancelGlide.current = glideScrollTop(viewport, top);
  };

  const followFocusedRow = useEffectEvent(() => glideForOpen(open));

  useEffect(() => {
    followFocusedRow();
    return () => cancelGlide.current?.();
  }, [focusIndex]);

  return { viewportRef, glideForOpen };
};
