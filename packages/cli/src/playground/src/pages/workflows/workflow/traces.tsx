import { useParams, useSearchParams } from 'react-router';

import { VNextWorkflowTraces } from '@/domains/workflows/v-next-workflow.traces';
import { WorkflowTraces } from '@/domains/workflows/workflow-traces';

function WorkflowTracesPage() {
  const { workflowId } = useParams();
  const [searchParams] = useSearchParams();
  const isVNext = searchParams.get('version') === 'v-next';

  if (isVNext) {
    return <VNextWorkflowTraces workflowId={workflowId!} />;
  }

  return <WorkflowTraces workflowId={workflowId!} />;
}

export default WorkflowTracesPage;
