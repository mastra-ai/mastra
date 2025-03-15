import { MastraResizablePanel, WorkflowGraph } from '@mastra/playground-ui';
import { useParams } from 'react-router';

import { WorkflowInformation } from '@/domains/workflows/workflow-information';

function Workflow() {
  const { workflowId } = useParams();

  return (
    <main className="flex-1 relative divide-x flex">
      <div className="w-[calc(100%_-_400px)]">
        <WorkflowGraph workflowId={workflowId!} baseUrl="" />
      </div>
      <MastraResizablePanel
        defaultWidth={30}
        minimumWidth={30}
        maximumWidth={50}
        className="flex flex-col min-w-[400px] absolute right-0 top-0 h-full z-20 bg-[#121212]"
      >
        <WorkflowInformation workflowId={workflowId!} />
      </MastraResizablePanel>
    </main>
  );
}

export default Workflow;
