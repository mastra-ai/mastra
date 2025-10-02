import { WorkflowInformation } from '@/domains/workflows/workflow-information';
import { useSendWorkflowRunEvent } from '@/hooks/use-workflows';
import { MainContentContent, WorkflowGraph, WorkflowRuns, useWorkflow } from '@mastra/playground-ui';
import { useNavigate, useParams } from 'react-router';

export const Workflow = () => {
  const { workflowId, runId } = useParams();
  const navigate = useNavigate();
  const { data: workflow, isLoading } = useWorkflow(workflowId!);
  const { mutateAsync: sendWorkflowRunEvent } = useSendWorkflowRunEvent(workflowId!);

  return (
    <MainContentContent isDivided={true} hasLeftServiceColumn={true}>
      <WorkflowRuns workflowId={workflowId!} runId={runId} />

      <WorkflowGraph
        workflowId={workflowId!}
        workflow={workflow || undefined}
        isLoading={isLoading}
        onShowTrace={({ runId, stepName }) => {
          navigate(`/workflows/${workflowId}/traces?runId=${runId}&stepName=${stepName}`);
        }}
        onSendEvent={sendWorkflowRunEvent}
      />

      <WorkflowInformation workflowId={workflowId!} />
    </MainContentContent>
  );
};
