import { useMatch, useParams } from 'react-router';

import { sessionUnavailableError, useUserSessionQuery } from '../../../../hooks/useWorkspaces';

/** Workspace for the current route — user threads have no `sessionId` segment, so resolve from the thread. */
export function useThreadWorkspacePath() {
  const { sessionId, threadId } = useParams<{ sessionId?: string; threadId?: string }>();
  const isUserThreadRoute = Boolean(useMatch('/factories/:factoryId/user/threads/:threadId'));
  const routedSessionId = isUserThreadRoute ? threadId : sessionId;
  const session = useUserSessionQuery(routedSessionId);
  const unavailable = sessionUnavailableError(session);

  return {
    // The route already names the session, so the panel claims its space before the read lands.
    workspacePath: unavailable ? undefined : routedSessionId,
    threadId,
    isPending: isUserThreadRoute && session.isPending,
    error: isUserThreadRoute ? unavailable : undefined,
  };
}
