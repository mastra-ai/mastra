import { BaseEdge, useInternalNode } from '@xyflow/react';
import type { EdgeProps, InternalNode } from '@xyflow/react';
import { useId } from 'react';

import { moveBow } from './movesLayout';
import type { Emphasis, MoveEdgeModel } from './movesLayout';

const COLOR: Record<'transition' | 'event', string> = {
  transition: 'var(--color-chart-blue)',
  event: 'var(--color-chart-purple)',
};

const OPACITY: Record<Emphasis, number> = { active: 1, idle: 0.5, faint: 0.12, hidden: 0, dimmed: 0.1 };

function box(node: InternalNode) {
  const { x, y } = node.internals.positionAbsolute;
  const width = node.measured.width ?? node.width ?? 0;
  const height = node.measured.height ?? node.height ?? 0;
  return { left: x, right: x + width, middle: y + height / 2 };
}

/**
 * A move between two phases bows out right of the column, further the more phases it skips so the curves nest
 * instead of overlapping. An event move runs from its event card on the left into the phase's left edge.
 */
export function MoveEdge({ id, source, target, data }: EdgeProps<MoveEdgeModel>) {
  const from = useInternalNode(source);
  const to = useInternalNode(target);
  const arrowId = useId();
  if (!from || !to || !data) return null;
  const start = box(from);
  const end = box(to);

  let path: string;
  if (data.kind === 'transition') {
    const x0 = start.right;
    const x1 = end.right;
    const bow = moveBow(data.transition.distance);
    // Leave a little below the middle and arrive a little above it, so a phase's way out and way in don't meet.
    const y0 = start.middle + 8;
    const y1 = end.middle - 8;
    path = `M${x0} ${y0} C${x0 + bow} ${y0} ${x1 + bow} ${y1} ${x1} ${y1}`;
  } else {
    const midX = (start.right + end.left) / 2;
    path = `M${start.right} ${start.middle} C${midX} ${start.middle} ${midX} ${end.middle} ${end.left} ${end.middle}`;
  }
  if (data.emphasis === 'hidden') return null;
  const color = COLOR[data.kind];
  const active = data.emphasis === 'active';

  return (
    <>
      <defs>
        <marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M1 1 L9 5 L1 9 Z" fill={color} fillOpacity={OPACITY[data.emphasis]} />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={`url(#${arrowId})`}
        style={{
          stroke: color,
          strokeOpacity: OPACITY[data.emphasis],
          strokeWidth: active ? 2 : 1.25,
          strokeLinecap: 'round',
          strokeDasharray: data.kind === 'event' || !active ? '5 6' : 'none',
          transition: 'stroke-opacity 150ms',
        }}
        vectorEffect="non-scaling-stroke"
        data-move-from={source}
        data-move-to={target}
        data-emphasis={data.emphasis}
      />
    </>
  );
}
