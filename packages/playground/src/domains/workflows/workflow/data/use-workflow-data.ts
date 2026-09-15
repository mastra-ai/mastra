import { useContext } from 'react';
import { useCurrentRun } from '../../context/use-current-run';
import { WorkflowRunContext } from '../../context/workflow-run-context';
import type { WorkflowDataSelection } from '../../context/workflow-step-detail-context';
import { getWorkflowBoundaryData } from '../workflow-boundary-data';

export function workflowDataKey(selection: WorkflowDataSelection) {
  return `${selection.type}:${'stepId' in selection ? selection.stepId : (selection.workflowName ?? '')}`;
}

export function useWorkflowData(selection: WorkflowDataSelection): {
  name: string;
  direction: 'input' | 'output';
  label: string;
  value: unknown;
} {
  const { steps } = useCurrentRun();
  const workflowRun = useContext(WorkflowRunContext);

  if ('stepId' in selection) {
    const step = steps[selection.stepId];
    const direction = selection.type === 'step-input' ? 'input' : 'output';
    const output: unknown = step?.output !== undefined ? step.output : step?.suspendOutput;
    return {
      name: selection.stepId,
      direction,
      label: `${selection.stepId} ${direction}`,
      value: direction === 'input' ? step?.input : output,
    };
  }

  const boundaryData = selection.workflowName
    ? getWorkflowBoundaryData(steps, selection.workflowName)
    : {
        input: workflowRun.payload ?? workflowRun.result?.input,
        output: workflowRun.result?.status === 'success' ? workflowRun.result.result : undefined,
      };
  const direction = selection.type === 'workflow-input' ? 'input' : 'output';
  const name = selection.workflowName ?? workflowRun.workflow?.name ?? 'Workflow';
  return { name, direction, label: `${name} ${direction}`, value: boundaryData[direction] };
}
