import { useParams } from 'react-router';

import { WorkflowTraces } from '@mastra/playground-ui';

import { Skeleton } from '@/components/ui/skeleton';

import { WorkflowInformation } from '@/domains/workflows/workflow-information';
import { useVNextWorkflow } from '@/hooks/use-workflows';

function WorkflowTracesPage() {
  const { workflowId } = useParams();

  const { vNextWorkflow, isLoading: isWorkflowLoading } = useVNextWorkflow(workflowId!);

  if (isWorkflowLoading) {
    return (
      <main className="flex-1 relative grid grid-cols-[1fr_325px] divide-x">
        <div className="p-4">
          <Skeleton className="h-[600px]" />
        </div>
        <div className="flex flex-col">
          <WorkflowInformation workflowId={workflowId!} isVNext />
        </div>
      </main>
    );
  }

  return (
    <WorkflowTraces
      workflowName={vNextWorkflow?.name || ''}
      baseUrl=""
      sidebarChild={<WorkflowInformation workflowId={workflowId!} isVNext />}
    />
  );
}

export default WorkflowTracesPage;
