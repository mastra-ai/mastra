import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { memo } from 'react';

import { useCurrentRun } from '../context/use-current-run';
import { WorkflowEdgeDataButton } from './components/workflow-edge-data-button';

export const WORKFLOW_DATA_EDGE_TYPE = 'workflow-data-edge';

export interface WorkflowDataEdgeData {
  previousStepId?: string;
  nextStepId?: string;
  conditionNode?: boolean;
}

export interface WorkflowDataEdgeProps extends EdgeProps {
  parentWorkflowName?: string;
}

const getScopedStepId = (stepId: string | undefined, workflowName?: string) =>
  stepId && workflowName ? `${workflowName}.${stepId}` : stepId;

const WorkflowDataEdgeComponent = (props: WorkflowDataEdgeProps) => {
  const { steps } = useCurrentRun();
  const data = props.data as WorkflowDataEdgeData | undefined;
  const previousStepKey = getScopedStepId(data?.previousStepId, props.parentWorkflowName);
  const previousStep = previousStepKey ? steps[previousStepKey] : undefined;
  const output = previousStep?.output ?? previousStep?.suspendOutput;
  const [edgePath, labelX, labelY] = getBezierPath(props);

  return (
    <>
      <BaseEdge id={props.id} path={edgePath} markerEnd={props.markerEnd} style={props.style} />
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
            previousStepId={data?.previousStepId}
            output={output}
          />
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export const WorkflowDataEdge = memo(WorkflowDataEdgeComponent) as typeof WorkflowDataEdgeComponent;
