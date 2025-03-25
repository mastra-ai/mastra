import { MastraResizablePanel, WorkflowGraph } from '@mastra/playground-ui';
import { useParams } from 'react-router';

import { WorkflowInformation } from '@/domains/workflows/workflow-information';

function Workflow() {
  const { workflowId } = useParams();

  return (
    <main className="flex-1 relative divide-x flex w-full">
      <div className="min-w-[325px] grow">
        <WorkflowGraph workflowId={workflowId!} baseUrl="" />
      </div>
      <MastraResizablePanel
        defaultWidth={20}
        minimumWidth={20}
        maximumWidth={60}
        className="flex flex-col min-w-[325px] right-0 top-0 h-full z-20 bg-[#121212] [&>div:first-child]:-left-[1px] [&>div:first-child]:-right-[1px] [&>div:first-child]:w-[1px] [&>div:first-child]:bg-[#424242] [&>div:first-child]:hover:w-[2px] [&>div:first-child]:active:w-[2px]"
      >
        <WorkflowInformation workflowId={workflowId!} />
      </MastraResizablePanel>
    </main>
  );
}

export default Workflow;
