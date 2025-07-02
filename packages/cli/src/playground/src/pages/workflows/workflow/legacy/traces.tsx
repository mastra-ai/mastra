import { useParams } from 'react-router';
import { WorkflowTraces } from '@mastra/playground-ui';

import { Skeleton } from '@/components/ui/skeleton';

import { WorkflowInformation } from '@/domains/workflows/workflow-information';
import { useLegacyWorkflow } from '@/hooks/use-workflows';
import { useTraces } from '@/domains/traces/hooks/use-traces';

function WorkflowTracesPage() {
  const { workflowId } = useParams();
  const { data: legacyWorkflow, isLoading: isWorkflowLoading } = useLegacyWorkflow(workflowId!);

  // This hook will now be called within a TraceProvider context
  const { traces, error, firstCallLoading } = useTraces(legacyWorkflow?.name || '', true);

  if (isWorkflowLoading || firstCallLoading) {
    return (
      <main className="flex-1 relative grid grid-cols-[1fr_325px] divide-x h-full">
        <div className="p-4">
          <Skeleton className="h-[600px]" />
        </div>
        <div className="flex flex-col">
          <WorkflowInformation workflowId={workflowId!} isLegacy />
        </div>
      </main>
    );
  }

  return <WorkflowTraces traces={traces} error={error} />;
}

export default WorkflowTracesPage;
