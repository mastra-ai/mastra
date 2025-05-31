import { WorkflowGraph } from '@mastra/playground-ui';
import { useNavigate, useParams } from 'react-router';

export const Workflow = () => {
  const { workflowId } = useParams();
  const navigate = useNavigate();

  return (
    <WorkflowGraph
      workflowId={workflowId!}
      baseUrl=""
      onShowTrace={({ runId, stepName }) => {
        navigate(`/workflows/${workflowId}/traces?runId=${runId}&stepName=${stepName}`);
      }}
    />
  );
};
