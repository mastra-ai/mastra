import { WorkflowTraces } from '@mastra/playground-ui';
import { useParams } from 'react-router';

import { Skeleton } from '@/components/ui/skeleton';

import { WorkflowInformation } from '@/domains/workflows/workflow-information';
import { useWorkflow } from '@/hooks/use-workflows';

function WorkflowTracesPage() {
  const { workflowId } = useParams();
  const { workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId!);

  if (isWorkflowLoading) {
    return (
      <main className="flex-1 relative grid grid-cols-[1fr_325px] divide-x">
        <div className="p-4">
          <Skeleton className="h-[600px]" />
        </div>
        <div className="flex flex-col">
          <WorkflowInformation workflowId={workflowId!} />
        </div>
      </main>
    );
  }

  return (
    <WorkflowTraces
      workflowName={workflow?.name!}
      baseUrl=""
      sidebarChild={<WorkflowInformation workflowId={workflowId!} />}
    />
  );
}

export default WorkflowTracesPage;
