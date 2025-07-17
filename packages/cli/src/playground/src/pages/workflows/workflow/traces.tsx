import { useParams, useSearchParams } from 'react-router';
import { TracesView, TracesViewSkeleton } from '@mastra/playground-ui';

import { useWorkflow } from '@/hooks/use-workflows';

function WorkflowTracesPage() {
  const { workflowId } = useParams();
  const [searchParams] = useSearchParams();
  const runId = searchParams.get('runId');
  const stepName = searchParams.get('stepName');
  const { data: workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId!);

  // This hook will now be called within a TraceProvider context

  if (isWorkflowLoading) {
    return <TracesViewSkeleton />;
  }

  return (
    <TracesView
      componentType="workflow"
      componentName={workflow?.name || ''}
      runId={runId || undefined}
      stepName={stepName || undefined}
    />
  );
}

export default WorkflowTracesPage;
