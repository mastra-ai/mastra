import { Truncate } from '@mastra/playground-ui';
import { useParams } from 'react-router';
import { WorkflowCombobox } from './components/workflow-combobox';

export function WorkflowCrumb() {
  const { workflowId } = useParams<{ workflowId: string }>();
  if (!workflowId) return null;

  return <WorkflowCombobox value={workflowId} variant="ghost" />;
}

export function WorkflowRunCrumb() {
  const { runId } = useParams<{ runId: string }>();
  if (!runId) return null;

  return (
    <Truncate untilChar="-" copy>
      {runId}
    </Truncate>
  );
}
