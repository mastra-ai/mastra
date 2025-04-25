import { WorkflowTraces as PlaygroundWorkflowTraces } from '@mastra/playground-ui';

import { Skeleton } from '@/components/ui/skeleton';

import { WorkflowInformation } from '@/domains/workflows/workflow-information';
import { useWorkflow } from '@/hooks/use-workflows';

export function WorkflowTraces({ workflowId }: { workflowId: string }) {
  const { workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId);

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
    <PlaygroundWorkflowTraces
      workflowName={workflow?.name || ''}
      baseUrl=""
      sidebarChild={<WorkflowInformation workflowId={workflowId!} />}
    />
  );
}
