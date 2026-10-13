import { EntityType } from '@mastra/core/observability';
import { useParams } from 'react-router';
import TracesPage from '@/pages/traces';

function WorkflowTraces() {
  const { workflowId } = useParams();
  if (!workflowId) return null;
  return <TracesPage scopedEntityId={workflowId} scopedEntityType={EntityType.WORKFLOW_RUN} />;
}

export default WorkflowTraces;
