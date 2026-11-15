import { useMatch, useParams } from 'react-router';

import { useUserSessionQuery, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { getUserSessionLabel } from '../../workspaces/services/sessionPresentation';

export function useOpenSession() {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId: string; sessionId: string; threadId: string }>();
  // User threads carry the session id as `threadId` (see ChatSessionProvider).
  const isUserThread = Boolean(useMatch('/factories/:factoryId/user/threads/:threadId'));
  const userSessionId = sessionId ?? threadId;
  const sessionQuery = useUserSessionQuery(userSessionId);
  const workspaces = useWorkspacesQuery(factoryId);
  // Prefer the list row: PageTitle patches it with the generated title, the detail cache is not updated.
  const session = workspaces.data?.userSessions.find(entry => entry.sessionId === userSessionId) ?? sessionQuery.data;

  return {
    session,
    isUserThread,
    title: session && isUserThread ? getUserSessionLabel(session) : session?.title?.trim() || undefined,
    loading: session === undefined && sessionQuery.isLoading,
  };
}
