import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

import { useWorkflow } from '@/hooks/use-workflows';

export function WorkflowDetails({ workflowId }: { workflowId: string }) {
  const { isLoading, workflow } = useWorkflow(workflowId);

  if (isLoading) {
    return (
      <ScrollArea className="h-[calc(100vh-126px)] pt-2 px-4 pb-4 text-xs">
        <div className="space-y-4">
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <Skeleton className="h-3" />
            <Skeleton className="h-3" />
          </div>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-126px)] pt-2 px-4 pb-4 text-xs">
      <div className="space-y-4">
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <p className="text-mastra-el-3">Name</p>
          <p className="text-mastra-el-5">{workflow?.name}</p>
        </div>
      </div>
    </ScrollArea>
  );
}
