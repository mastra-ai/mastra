import type { TaskItem } from '@mastra/core/signals';
import { useId } from 'react';
import { TASK_ROW_HEIGHT, taskGraphMotion } from './task-graph-node';
import { cn } from '@/lib/utils';

type TaskStatus = TaskItem['status'];

const TRUNK_X = 8;
const LANE_X = 24;

const laneX = (status: TaskStatus, singleLane: boolean) => (status === 'in_progress' && !singleLane ? LANE_X : TRUNK_X);
const rowCenter = (index: number) => index * TASK_ROW_HEIGHT + TASK_ROW_HEIGHT / 2;

const ink: Record<TaskStatus, string> = {
  completed: 'var(--success-indicator)',
  in_progress: 'var(--warning-indicator)',
  pending: 'color-mix(in oklab, var(--muted-foreground) 45%, transparent)',
};

const connectorPathData = (upper: TaskStatus, lower: TaskStatus, index: number, singleLane: boolean) => {
  const fromY = rowCenter(index);
  const toY = rowCenter(index + 1);
  const midY = (fromY + toY) / 2;
  const fromX = laneX(upper, singleLane);
  const toX = laneX(lower, singleLane);
  return `M ${fromX} ${fromY} C ${fromX} ${midY} ${toX} ${midY} ${toX} ${toY}`;
};

interface TaskGraphSegmentProps {
  upper: TaskStatus;
  lower: TaskStatus;
  index: number;
  graphId: string;
  singleLane: boolean;
}

const TaskGraphSegment = ({ upper, lower, index, graphId, singleLane }: TaskGraphSegmentProps) => {
  const pathData = connectorPathData(upper, lower, index, singleLane);
  const d = `path("${pathData}")`;
  const reached = upper !== 'pending' && lower !== 'pending';
  const touchesActive = upper === 'in_progress' || lower === 'in_progress';

  return (
    <g>
      <path
        d={pathData}
        fill="none"
        strokeWidth={1}
        mask={`url(#${graphId}-future)`}
        className={cn('transition-[d]', taskGraphMotion)}
        style={{ d, stroke: ink.pending }}
      />
      <path
        d={pathData}
        fill="none"
        strokeWidth={1}
        pathLength={1}
        strokeDasharray="1 1"
        className={cn('transition-[d,stroke-dashoffset,stroke]', taskGraphMotion)}
        style={{ d, strokeDashoffset: reached ? 0 : 1, stroke: touchesActive ? ink.in_progress : ink.completed }}
      />
    </g>
  );
};

interface TaskGraphLinesProps {
  statuses: TaskStatus[];
  singleLane?: boolean;
}

export const TaskGraphLines = ({ statuses, singleLane = false }: TaskGraphLinesProps) => {
  const graphId = `task-graph${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const height = statuses.length * TASK_ROW_HEIGHT;
  const maskBox = { x: -8, y: 0, width: LANE_X + 24, height };

  return (
    <svg
      aria-hidden
      width={LANE_X + 8}
      height={height}
      className="pointer-events-none absolute top-0 left-0 overflow-visible"
    >
      <defs>
        <linearGradient id={`${graphId}-fade`} gradientUnits="userSpaceOnUse" x1={0} x2={0} y1={0} y2={height}>
          <stop offset="0" stopColor="white" stopOpacity={1} />
          <stop offset="1" stopColor="white" stopOpacity={0.15} />
        </linearGradient>
        <mask id={`${graphId}-future`} maskUnits="userSpaceOnUse" {...maskBox}>
          <rect {...maskBox} fill={`url(#${graphId}-fade)`} />
        </mask>
        <linearGradient id={`${graphId}-gap`} x1={0} x2={0} y1={0} y2={1}>
          <stop offset="0.2" stopColor="white" stopOpacity={0} />
          <stop offset="0.4" stopColor="white" stopOpacity={1} />
          <stop offset="0.6" stopColor="white" stopOpacity={1} />
          <stop offset="0.8" stopColor="white" stopOpacity={0} />
        </linearGradient>
        <pattern
          id={`${graphId}-gaps`}
          patternUnits="userSpaceOnUse"
          x={maskBox.x}
          y={TASK_ROW_HEIGHT / 2}
          width={maskBox.width}
          height={TASK_ROW_HEIGHT}
        >
          <rect width={maskBox.width} height={TASK_ROW_HEIGHT} fill={`url(#${graphId}-gap)`} />
        </pattern>
        <mask id={`${graphId}-between-nodes`} maskUnits="userSpaceOnUse" {...maskBox}>
          <rect {...maskBox} fill={`url(#${graphId}-gaps)`} />
        </mask>
      </defs>
      <g mask={`url(#${graphId}-between-nodes)`}>
        {statuses.map((status, index) => {
          const next = statuses[index + 1];
          if (!next) return null;
          return (
            <TaskGraphSegment
              key={index}
              upper={status}
              lower={next}
              index={index}
              graphId={graphId}
              singleLane={singleLane}
            />
          );
        })}
      </g>
    </svg>
  );
};
