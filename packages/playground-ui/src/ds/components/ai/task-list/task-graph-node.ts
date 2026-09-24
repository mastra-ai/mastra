import type { TaskItem } from '@mastra/core/signals';
import { useEffect, useRef } from 'react';

type TaskStatus = TaskItem['status'];

export const TASK_ROW_HEIGHT = 28;
export const TASK_GRAPH_MOTION_MS = 600;

/* One timing for nodes and lines, so a line end never detaches from its node mid-move. */
export const taskGraphMotion = 'duration-[600ms] ease-(--resize-ease) motion-reduce:transition-none';

/* left-0.5 centres the 12px node on the trunk (x=8); translate-x-4 lands it on the lane (x=24). */
export const taskGraphNodeClass = 'absolute top-1/2 left-0.5 -translate-y-1/2 transition-[translate]';
export const taskGraphLaneShift: Record<TaskStatus, string> = {
  completed: 'translate-x-0',
  in_progress: 'translate-x-4',
  pending: 'translate-x-0',
};

export const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export const useCompletionPulse = <T extends HTMLElement>(status: TaskStatus) => {
  const ref = useRef<T>(null);
  const previousStatus = useRef(status);

  useEffect(() => {
    if (previousStatus.current === status) return;
    previousStatus.current = status;
    const node = ref.current;
    if (status !== 'completed' || typeof node?.animate !== 'function' || prefersReducedMotion()) return;
    node.animate(
      [
        { boxShadow: '0 0 0 0 color-mix(in oklab, var(--accent1) 45%, transparent)' },
        { boxShadow: '0 0 0 5px color-mix(in oklab, var(--accent1) 0%, transparent)' },
      ],
      { duration: 700, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
    );
  }, [status]);

  return ref;
};

const easeOutQuint = (progress: number) => 1 - (1 - progress) ** 5;

export const glideScrollTop = (viewport: HTMLElement, top: number) => {
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
