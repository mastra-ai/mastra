import { useAgentWorkflowById } from '@/hooks/use-agent-workflow-by-id';
import { Spinner, Txt, WorkflowGraph } from '@mastra/playground-ui';
import { useNavigate, useParams, useSearchParams } from 'react-router';

export const Workflow = () => {
  const { workflowId } = useParams();
  const [searchParams] = useSearchParams();
  const agentId = searchParams.get('agentId');
  const navigate = useNavigate();

  const { workflow, isLoading } = useAgentWorkflowById({ agentId: agentId || undefined, workflowId: workflowId! });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full w-full">
        <Spinner />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex justify-center items-center h-full w-full">
        <Txt variant="header-md" as="h2">
          Workflow not found
        </Txt>
      </div>
    );
  }

  return (
    <WorkflowGraph
      workflowId={workflowId!}
      workflow={workflow}
      isLoading={isLoading}
      onShowTrace={({ runId, stepName }) => {
        navigate(`/workflows/${workflowId}/traces?runId=${runId}&stepName=${stepName}`);
      }}
    />
  );
};
