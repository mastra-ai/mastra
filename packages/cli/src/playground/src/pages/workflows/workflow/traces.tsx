import { useParams } from 'react-router';

import { Skeleton } from '@/components/ui/skeleton';

import { TraceProvider } from '@/domains/traces/context/trace-context';
import { WorkflowInformation } from '@/domains/workflows/workflow-information';
import { WorkflowTraces } from '@/domains/workflows/workflow-traces';
import { useWorkflow } from '@/hooks/use-workflows';

function WorkflowTracesPage() {
  const { workflowId } = useParams();
  const { workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId!);

  if (isWorkflowLoading) {
    return (
      <main className="flex-1 relative grid grid-cols-[1fr_400px] divide-x">
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
    <TraceProvider>
      <WorkflowTraces workflowId={workflowId!} workflowName={workflow?.name!} />
    </TraceProvider>
  );
}

export default WorkflowTracesPage;
