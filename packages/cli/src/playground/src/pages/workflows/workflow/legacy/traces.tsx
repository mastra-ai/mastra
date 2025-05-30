import { useParams } from 'react-router';
import { useTraces, WorkflowTraces } from '@mastra/playground-ui';

import { Skeleton } from '@/components/ui/skeleton';

import { WorkflowInformation } from '@/domains/workflows/workflow-information';
import { useLegacyWorkflow } from '@/hooks/use-workflows';

function WorkflowTracesContent() {
  const { workflowId } = useParams();
  const { legacyWorkflow, isLoading: isWorkflowLoading } = useLegacyWorkflow(workflowId!);
  const { traces, error, firstCallLoading } = useTraces(legacyWorkflow?.name || '', '', true);

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

function WorkflowTracesPage() {
  return <WorkflowTracesContent />;
}

export default WorkflowTracesPage;
