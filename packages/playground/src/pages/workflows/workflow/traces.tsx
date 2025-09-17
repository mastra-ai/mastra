import { useParams, useSearchParams } from 'react-router';
import { TracesView, useWorkflow } from '@mastra/playground-ui';

import { useTraces } from '@/domains/traces/hooks/use-traces';

function WorkflowTracesPage() {
  const { workflowId } = useParams();
  const [searchParams] = useSearchParams();
  const runId = searchParams.get('runId');
  const stepName = searchParams.get('stepName');
  const { data: workflow, isLoading: isWorkflowLoading } = useWorkflow(workflowId!);
  const {
    data: traces = [],
    isLoading: isTracesLoading,
    setEndOfListElement,
    error,
  } = useTraces(workflow?.name || '', true);

  return (
    <TracesView
      traces={traces}
      isLoading={isWorkflowLoading || isTracesLoading}
      error={error}
      setEndOfListElement={setEndOfListElement}
      runId={runId || undefined}
      stepName={stepName || undefined}
    />
  );
}

export default WorkflowTracesPage;
