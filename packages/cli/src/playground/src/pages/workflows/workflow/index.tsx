import { WorkflowGraph } from '@mastra/playground-ui';
import { useParams } from 'react-router';

export const Workflow = () => {
  const { workflowId } = useParams();

  return <WorkflowGraph workflowId={workflowId!} baseUrl="" />;
};
