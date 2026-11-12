import { useMatch, useParams } from 'react-router';

import { useUserSessionQuery } from '../../../../hooks/useWorkspaces';
import { appRoot } from '../../../lib/app-root';

/** Workspace for the current route — user threads have no `sessionId` segment, so resolve from the thread. */
export function useThreadWorkspacePath() {
  const { sessionId, threadId } = useParams<{ sessionId?: string; threadId?: string }>();
  const isUserThreadRoute = Boolean(useMatch(`${appRoot()}/factories/:factoryId/user/threads/:threadId`));
  const userSession = useUserSessionQuery(isUserThreadRoute ? threadId : undefined);

  return {
    workspacePath: isUserThreadRoute ? userSession.data?.sessionId : sessionId,
    threadId,
    isPending: isUserThreadRoute && userSession.isPending,
    error: isUserThreadRoute ? (userSession.error ?? undefined) : undefined,
    retry: () => void userSession.refetch(),
  };
}
