import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { useAgents } from '@mastra/react/hooks/agents';
import { isAuthenticated, useAuthCapabilities } from '@mastra/react/hooks/auth';
import { RecentAgentsList } from './recent-agents-list';

export function RecentAgents({ agentId, view = 'chat' }: { agentId: string; view?: 'chat' | 'agent' }) {
  const { data: agents, isLoading } = useAgents();
  const { data: auth } = useAuthCapabilities();

  if (isLoading || !auth) {
    return <Skeleton className="m-3 h-24 shrink-0" />;
  }
  if (!agents || (auth.enabled && !isAuthenticated(auth))) return null;

  const userId = isAuthenticated(auth) ? auth.user.id : undefined;
  return (
    <RecentAgentsList
      key={`${agentId}:${userId ?? ''}`}
      agentId={agentId}
      userId={userId}
      agents={agents}
      view={view}
    />
  );
}
