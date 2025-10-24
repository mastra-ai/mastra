import { WorkflowGraph, useWorkflow } from '@mastra/playground-ui';
import { useNavigate, useParams } from 'react-router';

export const Workflow = () => {
  const { workflowId } = useParams();
  const navigate = useNavigate();
  const { data: workflow, isLoading } = useWorkflow(workflowId!);

  return (
    <WorkflowGraph
      workflowId={workflowId!}
      workflow={workflow ?? undefined}
      isLoading={isLoading}
      onShowTrace={({ runId, stepName }) => {
        navigate(`/workflows/${workflowId}/traces?runId=${runId}&stepName=${stepName}`);
      }}
    />
  );
};
