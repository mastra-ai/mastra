import { useParams } from 'react-router';
import { TraceProvider, useTraces, WorkflowTraces } from '@mastra/playground-ui';

import { Skeleton } from '@/components/ui/skeleton';

import { WorkflowInformation } from '@/domains/workflows/workflow-information';
import { useWorkflow } from '@/hooks/use-workflows';

function WorkflowTracesInner() {
  const { workflowId } = useParams();
  const { workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId!);

  // This hook will now be called within a TraceProvider context
  const { traces, error, firstCallLoading } = useTraces(workflow?.name || '', '', true);

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
      traces={traces}
      isLoading={firstCallLoading}
      error={error}
      sidebarChild={<WorkflowInformation workflowId={workflowId!} />}
    />
  );
}

function WorkflowTracesPage() {
  // Wrap with TraceProvider to ensure proper context for useTraces
  return (
    <TraceProvider>
      <WorkflowTracesInner />
    </TraceProvider>
  );
}

export default WorkflowTracesPage;
