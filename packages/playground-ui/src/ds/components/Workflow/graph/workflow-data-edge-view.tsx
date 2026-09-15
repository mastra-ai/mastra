import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { WorkflowEdgeDataButton } from '../data/workflow-edge-data-button';
import type { WorkflowDataEdgeModel } from './types';

export interface WorkflowDataEdgeViewProps extends EdgeProps<WorkflowDataEdgeModel> {
  output?: unknown;
  label?: string;
}

export function WorkflowDataEdgeView({ output, label, ...props }: WorkflowDataEdgeViewProps) {
  const [edgePath, labelX, labelY] = getBezierPath(props);

  return (
    <>
      <BaseEdge
        id={props.id}
        path={edgePath}
        markerEnd={props.markerEnd}
        style={props.style}
        data-edge-status={props.data?.edgeStatus ?? 'idle'}
        data-edge-from={props.data?.previousStepId}
        data-edge-to={props.data?.nextStepId}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            pointerEvents: 'all',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          <WorkflowEdgeDataButton
            previousStepId={props.data?.boundaryPayload ? undefined : props.data?.previousStepId}
            output={output}
            label={label}
          />
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
