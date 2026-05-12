import { EntityType } from '@mastra/core/observability';
import { useParams } from 'react-router';
import TracesPage from '@/pages/traces';

function AgentTraces() {
  const { agentId } = useParams();
  if (!agentId) return null;
  return <TracesPage scopedEntityId={agentId} scopedEntityType={EntityType.AGENT} />;
}

export default AgentTraces;
