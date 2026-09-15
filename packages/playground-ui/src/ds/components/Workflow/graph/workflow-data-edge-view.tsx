import { BaseEdge, EdgeLabelRenderer, getBezierPath, Position, useInternalNode } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { WorkflowEdgeDataButton } from '../data/workflow-edge-data-button';
import type { WorkflowDataEdgeModel } from './types';

export interface WorkflowDataEdgeViewProps extends EdgeProps<WorkflowDataEdgeModel> {
  output?: unknown;
  label?: string;
  dataControl?: ReactNode;
}

export function WorkflowDataEdgeView({ output, label, dataControl, ...props }: WorkflowDataEdgeViewProps) {
  const source = useInternalNode(props.source);
  const target = useInternalNode(props.target);
  const sourceWidth = source?.measured?.width ?? source?.width;
  const sourceHeight = source?.measured?.height ?? source?.height;
  const targetWidth = target?.measured?.width ?? target?.width;
  const hasBottomSource =
    source && sourceWidth !== undefined && sourceHeight !== undefined && props.sourcePosition === Position.Bottom;
  const hasTopTarget = target && targetWidth !== undefined && props.targetPosition === Position.Top;
  // Nested canvases scale DOM handle measurements twice; route in graph coordinates.
  const sourceX = hasBottomSource ? source.internals.positionAbsolute.x + sourceWidth / 2 : props.sourceX;
  const sourceY = hasBottomSource ? source.internals.positionAbsolute.y + sourceHeight : props.sourceY;
  const targetX = hasTopTarget ? target.internals.positionAbsolute.x + targetWidth / 2 : props.targetX;
  const targetY = hasTopTarget ? target.internals.positionAbsolute.y : props.targetY;
  const [edgePath, midpointX, midpointY] = getBezierPath({
    ...props,
    sourceX,
    sourceY,
    targetX,
    targetY,
  });
  const labelPlacement = props.data?.dataLabelPlacement;
  const labelX = labelPlacement === 'source' ? sourceX : midpointX;
  const labelY = labelPlacement === 'source' ? sourceY + Math.min(24, Math.max(0, (targetY - sourceY) / 4)) : midpointY;
  const arrowId = useId();
  const isExecuted = props.data?.edgeStatus === 'success';
  const pathColor = isExecuted ? 'color-mix(in oklab, var(--positive1) 82%, var(--neutral6))' : 'var(--neutral3)';

  return (
    <>
      <defs>
        <marker id={arrowId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M1 1 L9 5 L1 9 Z" fill={pathColor} />
        </marker>
      </defs>
      <BaseEdge
        id={props.id}
        path={edgePath}
        markerEnd={`url(#${arrowId})`}
        style={{
          ...props.style,
          stroke: pathColor,
          strokeWidth: isExecuted ? 2 : 1,
          strokeLinecap: 'round',
          strokeDasharray: isExecuted ? 'none' : '5 6',
          animation: 'none',
        }}
        vectorEffect="non-scaling-stroke"
        data-edge-status={props.data?.edgeStatus ?? 'idle'}
        data-edge-from={props.data?.previousStepId}
        data-edge-to={props.data?.nextStepId}
      />
      {labelPlacement !== 'hidden' && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan flex items-center justify-center"
            style={{
              position: 'absolute',
              pointerEvents: 'all',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {dataControl ?? (
              <WorkflowEdgeDataButton
                previousStepId={props.data?.boundaryPayload ? undefined : props.data?.previousStepId}
                output={output}
                label={label}
              />
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
