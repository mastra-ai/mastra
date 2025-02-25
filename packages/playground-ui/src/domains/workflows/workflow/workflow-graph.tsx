import { Skeleton } from '@/components/ui/skeleton';

import { useWorkflow } from '@/hooks/use-workflows';

import { WorkflowGraphInner } from './workflow-graph-inner';

export function WorkflowGraph({ workflowId, baseUrl }: { workflowId: string; baseUrl: string }) {
  const { workflow, isLoading } = useWorkflow(workflowId, baseUrl);

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="p-4">
        <p>Workflow not found</p>
      </div>
    );
  }

  return <WorkflowGraphInner workflow={workflow} />;
}
