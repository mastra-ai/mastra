import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useAgent } from '@mastra/react/hooks/agents';
import { useParams } from 'react-router';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import Metrics from '@/pages/metrics';

export function AgentMetrics() {
  const { agentId = '' } = useParams();
  const [requestContext] = useEntityRequestContext('agent', agentId);
  const { data: agent, isLoading, error } = useAgent({ agentId, requestContext });
  const { hasPermission, isLoading: isPermissionsLoading } = usePermissions();
  if (isLoading || isPermissionsLoading) return <Spinner aria-label="Loading agent metrics" />;
  if (!hasPermission('observability:read')) return <PermissionDenied variant="fill" resource="metrics" />;
  if (error || !agent)
    return <EmptyState tone="error" titleSlot="Could not load agent" descriptionSlot={error?.message} />;
  return <Metrics key={agentId} agentScope={{ id: agentId, name: agent.name }} />;
}
