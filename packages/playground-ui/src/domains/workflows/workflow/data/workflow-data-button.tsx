import { useWorkflowStepDetail } from '../../context/workflow-step-detail-context';
import type { WorkflowDataSelection } from '../../context/workflow-step-detail-context';
import { useWorkflowData, workflowDataKey } from './use-workflow-data';
import { WorkflowEdgeDataButton } from '@/ds/components/Workflow';

export function WorkflowDataButton({ selection }: { selection: WorkflowDataSelection }) {
  const { stepDetail, showData } = useWorkflowStepDetail();
  const { value, label } = useWorkflowData(selection);
  const selected = stepDetail?.type === 'data' && workflowDataKey(stepDetail.selection) === workflowDataKey(selection);

  return (
    <WorkflowEdgeDataButton
      output={value}
      label={label}
      selected={selected}
      onInspect={event => showData(selection, event.currentTarget)}
    />
  );
}
