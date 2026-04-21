import { Navigate, useParams } from 'react-router';

import { useStoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';
import { EditLayoutWrapper } from '@/pages/cms/agents/edit-layout';

/**
 * Agent Studio variant of the agent edit layout. Reuses the shared
 * `EditLayoutWrapper` but overrides the base path, section list, and
 * post-publish redirect so Studio users never leave the Studio shell.
 *
 * Also enforces an ownership check: only the author of the agent may
 * open the edit view from the Studio. Everyone else is sent back to the
 * chat view.
 */
export function AgentStudioAgentEdit() {
  const { agentId } = useParams<{ agentId: string }>();
  const { data: user, isLoading: isUserLoading } = useCurrentUser();
  const { data: storedAgent, isLoading: isAgentLoading } = useStoredAgent(agentId);

  if (!agentId) return <Navigate to="/agent-studio/agents" replace />;
  if (isUserLoading || isAgentLoading) return null;

  // If we couldn't load the stored agent (e.g. a code agent or missing), fall
  // back to the chat view rather than exposing the admin edit form.
  if (!storedAgent) return <Navigate to={`/agent-studio/agents/${agentId}/chat`} replace />;

  const isOwner = !!user?.id && storedAgent.authorId === user.id;
  if (!isOwner) return <Navigate to={`/agent-studio/agents/${agentId}/chat`} replace />;

  return (
    <EditLayoutWrapper
      basePath={id => `/agent-studio/agents/${id}/edit`}
      simplifiedSections
      redirectOnSuccess={id => `/agent-studio/agents/${id}/chat`}
    />
  );
}

export default AgentStudioAgentEdit;
