import { useSendWorkflowRunEvent, useWorkflow } from '@/hooks/use-workflows';
import { WorkflowGraph } from '@mastra/playground-ui';
import { useNavigate, useParams } from 'react-router';

export const Workflow = () => {
  const { workflowId } = useParams();
  const navigate = useNavigate();
  const { data: workflow, isLoading } = useWorkflow(workflowId!);
  const { mutateAsync: sendWorkflowRunEvent } = useSendWorkflowRunEvent(workflowId!);

  return (
    <WorkflowGraph
      workflowId={workflowId!}
      workflow={workflow}
      isLoading={isLoading}
      onShowTrace={({ runId, stepName }) => {
        navigate(`/workflows/${workflowId}/traces?runId=${runId}&stepName=${stepName}`);
      }}
      onSendEvent={sendWorkflowRunEvent}
    />
  );
};
