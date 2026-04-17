import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router';
import { useRecentAgents } from '@/domains/agent-studio/hooks/use-recent-agents';

/**
 * Agent Studio chat entry point. Tracks the agent as recently opened for the
 * current user, then delegates to the main playground chat.
 */
export function AgentStudioAgentChat() {
  const { agentId, threadId } = useParams<{ agentId: string; threadId?: string }>();
  const { trackAgentOpened } = useRecentAgents();

  useEffect(() => {
    if (agentId) trackAgentOpened(agentId);
  }, [agentId, trackAgentOpened]);

  if (!agentId) return <Navigate to="/agent-studio/agents" replace />;

  const target = threadId ? `/agents/${agentId}/chat/${threadId}` : `/agents/${agentId}/chat/new`;
  return <Navigate to={target} replace />;
}

export default AgentStudioAgentChat;
