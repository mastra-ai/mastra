import { WorkflowDataEdgeView } from '@mastra/playground-ui/components/Workflow';
import type { WorkflowDataEdgeModel } from '@mastra/playground-ui/components/Workflow';
import type { EdgeProps } from '@xyflow/react';
import { memo, useContext } from 'react';

import { useCurrentRun } from '../context/use-current-run';
import { WorkflowRunContext } from '../context/workflow-run-context';

export interface WorkflowDataEdgeProps extends EdgeProps<WorkflowDataEdgeModel> {
  parentWorkflowName?: string;
}

const getScopedStepId = (stepId: string | undefined, workflowName?: string) =>
  stepId && workflowName ? `${workflowName}.${stepId}` : stepId;

const WorkflowDataEdgeComponent = (props: WorkflowDataEdgeProps) => {
  const { steps } = useCurrentRun();
  const workflowRun = useContext(WorkflowRunContext);
  const data = props.data;
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
  return <WorkflowDataEdgeView {...props} output={output} label={outputLabel} />;
};

export const WorkflowDataEdge = memo(WorkflowDataEdgeComponent);
