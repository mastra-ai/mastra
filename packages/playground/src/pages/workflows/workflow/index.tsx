import { WorkflowGraph, useWorkflow } from '@mastra/playground-ui';
import { useParams } from 'react-router';

export const Workflow = () => {
  const { workflowId } = useParams();

  // useWorkflow now works for both code-defined and stored workflows
  // The server resolves stored workflow definitions to executable workflows
  const { data: workflow, isLoading } = useWorkflow(workflowId!);

  return <WorkflowGraph workflowId={workflowId!} workflow={workflow ?? undefined} isLoading={isLoading} />;
};
