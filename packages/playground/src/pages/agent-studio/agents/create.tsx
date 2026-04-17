import { Navigate } from 'react-router';

/**
 * Agent Studio delegates agent creation to the existing CMS flow — there's no
 * separate API for creation, so we redirect rather than duplicate a complex
 * form. The CMS flow navigates to `/agents/:id/chat/new` on success, which the
 * sidebar's "recents" tracker picks up.
 */
export function AgentStudioAgentCreate() {
  return <Navigate to="/cms/agents/create" replace />;
}

export default AgentStudioAgentCreate;
