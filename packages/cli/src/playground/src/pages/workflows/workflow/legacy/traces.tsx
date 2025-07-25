import { useParams } from 'react-router';
import { TracesView } from '@mastra/playground-ui';
import { useLegacyWorkflow } from '@/hooks/use-workflows';
import { useTraces } from '@/domains/traces/hooks/use-traces';

function WorkflowTracesPage() {
  const { workflowId } = useParams();
  const { data: legacyWorkflow, isLoading: isWorkflowLoading } = useLegacyWorkflow(workflowId!);

  const {
    data: traces = [],
    isLoading: isTracesLoading,
    setEndOfListElement,
    error,
  } = useTraces(legacyWorkflow?.name || '', true);

  return (
    <TracesView
      traces={traces}
      isLoading={isWorkflowLoading || isTracesLoading}
      error={error}
      setEndOfListElement={setEndOfListElement}
    />
  );
}

export default WorkflowTracesPage;
