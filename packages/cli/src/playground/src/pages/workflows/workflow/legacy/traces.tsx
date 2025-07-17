import { useParams } from 'react-router';
import { TracesView, TracesViewSkeleton } from '@mastra/playground-ui';
import { useLegacyWorkflow } from '@/hooks/use-workflows';

function WorkflowTracesPage() {
  const { workflowId } = useParams();
  const { data: legacyWorkflow, isLoading: isWorkflowLoading } = useLegacyWorkflow(workflowId!);

  if (isWorkflowLoading) {
    return <TracesViewSkeleton />;
  }

  return <TracesView componentType="workflow" componentName={legacyWorkflow?.name || ''} />;
}

export default WorkflowTracesPage;
