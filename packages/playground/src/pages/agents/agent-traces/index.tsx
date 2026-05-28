import { useParams } from 'react-router';
import { EntityType } from '@/domains/observability/entity-type';
import TracesPage from '@/pages/traces';

function AgentTraces() {
  const { agentId } = useParams();
  if (!agentId) return null;
  return <TracesPage scopedEntityId={agentId} scopedEntityType={EntityType.AGENT} />;
}

export default AgentTraces;
