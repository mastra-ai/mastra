import { WorkflowGraph, useWorkflow, useSendWorkflowRunEvent } from '@mastra/playground-ui';
import { useParams } from 'react-router';

export const Workflow = () => {
  const { workflowId } = useParams();
  const { data: workflow, isLoading } = useWorkflow(workflowId!);
  const { mutateAsync: sendWorkflowRunEvent } = useSendWorkflowRunEvent(workflowId!);

  return (
    <WorkflowGraph
      workflowId={workflowId!}
      workflow={workflow ?? undefined}
      isLoading={isLoading}
      onSendEvent={sendWorkflowRunEvent}
    />
  );
};
