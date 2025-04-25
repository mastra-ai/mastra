import { WorkflowTraces as PlaygroundWorkflowTraces } from '@mastra/playground-ui';

import { Skeleton } from '@/components/ui/skeleton';

import { WorkflowInformation } from '@/domains/workflows/workflow-information';
import { useVNextWorkflow } from '@/hooks/use-workflows';

export function VNextWorkflowTraces({ workflowId }: { workflowId: string }) {
  const { vNextWorkflow, isLoading: isWorkflowLoading } = useVNextWorkflow(workflowId);

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
    <PlaygroundWorkflowTraces
      workflowName={vNextWorkflow?.name || ''}
      baseUrl=""
      sidebarChild={<WorkflowInformation workflowId={workflowId!} isVNext />}
    />
  );
}
