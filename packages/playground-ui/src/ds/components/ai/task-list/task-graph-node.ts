import type { TaskItem } from '@mastra/core/signals';

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
