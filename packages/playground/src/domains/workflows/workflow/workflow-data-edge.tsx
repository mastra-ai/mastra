import { BaseEdge, EdgeLabelRenderer, getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { memo, useContext } from 'react';

import { useCurrentRun } from '../context/use-current-run';
import { WorkflowRunContext } from '../context/workflow-run-context';
import { WorkflowEdgeDataButton } from './components/workflow-edge-data-button';

export const WORKFLOW_DATA_EDGE_TYPE = 'workflow-data-edge';

export interface WorkflowDataEdgeData {
  previousStepId?: string;
  nextStepId?: string;
  conditionNode?: boolean;
  boundaryPayload?: 'workflow-input' | 'workflow-output';
  edgeStatus?: 'success' | 'idle';
}

export interface WorkflowDataEdgeProps extends EdgeProps {
  parentWorkflowName?: string;
}

const getScopedStepId = (stepId: string | undefined, workflowName?: string) =>
  stepId && workflowName ? `${workflowName}.${stepId}` : stepId;

const WorkflowDataEdgeComponent = (props: WorkflowDataEdgeProps) => {
  const { steps } = useCurrentRun();
  const workflowRun = useContext(WorkflowRunContext);
  const data = props.data as WorkflowDataEdgeData | undefined;
  const previousStepKey = getScopedStepId(data?.previousStepId, props.parentWorkflowName);
  const previousStep = previousStepKey ? steps[previousStepKey] : undefined;
  const workflowInput = workflowRun.payload ?? workflowRun.result?.input;
  const workflowOutput = workflowRun.result?.status === 'success' ? workflowRun.result.result : undefined;
  const output =
    data?.boundaryPayload === 'workflow-input'
      ? workflowInput === null
        ? undefined
        : workflowInput
      : data?.boundaryPayload === 'workflow-output'
        ? workflowOutput
        : (previousStep?.output ?? previousStep?.suspendOutput);
  const outputLabel =
    data?.boundaryPayload === 'workflow-input'
      ? 'Workflow input'
      : data?.boundaryPayload === 'workflow-output'
        ? 'Workflow output'
        : undefined;
  const [edgePath, labelX, labelY] = getBezierPath(props);

  return (
    <>
      <BaseEdge
        id={props.id}
        path={edgePath}
        markerEnd={props.markerEnd}
        style={props.style}
        data-edge-status={data?.edgeStatus ?? 'idle'}
        data-edge-from={data?.previousStepId}
        data-edge-to={data?.nextStepId}
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
            previousStepId={data?.boundaryPayload ? undefined : data?.previousStepId}
            output={output}
            label={outputLabel}
          />
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export const WorkflowDataEdge = memo(WorkflowDataEdgeComponent) as typeof WorkflowDataEdgeComponent;
