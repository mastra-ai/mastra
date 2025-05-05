import { useParams } from 'react-router';
import { TraceProvider, useTraces, WorkflowTraces } from '@mastra/playground-ui';

import { Skeleton } from '@/components/ui/skeleton';

import { WorkflowInformation } from '@/domains/workflows/workflow-information';
import { useVNextWorkflow } from '@/hooks/use-workflows';

function WorkflowTracesContent() {
  const { workflowId } = useParams();
  const { vNextWorkflow, isLoading: isWorkflowLoading } = useVNextWorkflow(workflowId!);

  // This hook will now be called within a TraceProvider context
  const { traces, error, firstCallLoading } = useTraces(vNextWorkflow?.name || '', '', true);

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

  return <WorkflowTraces traces={traces} isLoading={firstCallLoading} error={error} />;
}

function WorkflowTracesPage() {
  return (
    <TraceProvider>
      <WorkflowTracesContent />
    </TraceProvider>
  );
}

export default WorkflowTracesPage;
