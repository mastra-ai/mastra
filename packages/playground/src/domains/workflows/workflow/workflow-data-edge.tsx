import { WorkflowDataEdgeView } from '@mastra/playground-ui/components/Workflow';
import type { WorkflowDataEdgeModel } from '@mastra/playground-ui/components/Workflow';
import type { EdgeProps } from '@xyflow/react';
import { memo } from 'react';
import type { WorkflowDataSelection } from '../context/workflow-step-detail-context';
import { WorkflowDataButton } from './data/workflow-data-button';

export interface WorkflowDataEdgeProps extends EdgeProps<WorkflowDataEdgeModel> {
  parentWorkflowName?: string;
}

function getEdgeDataSelection({ data, parentWorkflowName }: WorkflowDataEdgeProps): WorkflowDataSelection | undefined {
  if (data?.boundaryPayload) return { type: data.boundaryPayload, workflowName: parentWorkflowName };
  if (!data?.previousStepId) return undefined;
  const stepId = parentWorkflowName ? `${parentWorkflowName}.${data.previousStepId}` : data.previousStepId;
  return { type: 'step-output', stepId };
}

const WorkflowDataEdgeComponent = (props: WorkflowDataEdgeProps) => {
  const selection = getEdgeDataSelection(props);
  return <WorkflowDataEdgeView {...props} dataControl={selection && <WorkflowDataButton selection={selection} />} />;
};

export const WorkflowDataEdge = memo(WorkflowDataEdgeComponent);
