import { useSessionHost } from '../../chat/context/SessionHostContext';

import { useUserSessionQuery } from '../../../../hooks/useWorkspaces';
import { sessionUnavailableError, DraftSessionCreateError } from '../../chat/services/sessionErrors';

/** Workspace for the current route — user threads have no `sessionId` segment, so resolve from the thread. */
export function useThreadWorkspacePath() {
  const { sessionId, threadId, routeKind } = useSessionHost();
  const isUserThreadRoute = routeKind === 'user-thread';
  const routedSessionId = isUserThreadRoute ? threadId : sessionId;
  const session = useUserSessionQuery(routedSessionId);
  const unavailable = sessionUnavailableError(session);

  return {
    // The route already names the session, so the panel claims its space before the read lands.
    workspacePath: unavailable ? undefined : routedSessionId,
    threadId,
    isPending: isUserThreadRoute && session.isPending,
    error: isUserThreadRoute || unavailable instanceof DraftSessionCreateError ? unavailable : undefined,
  };
}
