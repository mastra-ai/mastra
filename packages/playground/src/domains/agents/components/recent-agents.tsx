import { isAuthenticated, useAuthCapabilities } from '@mastra/react/hooks/auth';
import { useRecentAgentIds } from '../hooks/use-recent-agent-ids';

function RecentAgentVisit({ agentId, userId }: { agentId: string; userId?: string }) {
  useRecentAgentIds(agentId, userId);
  return null;
}

export function RememberRecentAgent({ agentId }: { agentId: string }) {
  const { data: auth } = useAuthCapabilities();
  if (!auth || (auth.enabled && !isAuthenticated(auth))) return null;
  const userId = isAuthenticated(auth) ? auth.user.id : undefined;
  return <RecentAgentVisit key={`${agentId}:${userId ?? ''}`} agentId={agentId} userId={userId} />;
}
