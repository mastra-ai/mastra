import { WorkflowGraph } from '@mastra/playground-ui';
import { useParams } from 'react-router';

import { WorkflowInformation } from '@/domains/workflows/workflow-information';

function Workflow() {
  const { workflowId } = useParams();

  return (
    <main className="flex-1 relative grid grid-cols-[1fr_400px] divide-x">
      <WorkflowGraph workflowId={workflowId!} baseUrl="" />
      <div className="flex flex-col">
        <WorkflowInformation workflowId={workflowId!} />
      </div>
    </main>
  );
}

export default Workflow;
