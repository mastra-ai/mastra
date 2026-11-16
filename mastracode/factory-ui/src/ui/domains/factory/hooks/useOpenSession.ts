import { useMatch } from 'react-router';

import { useRouteSessionId } from '../../../../hooks/useRouteSessionId';
import { useUserSessionQuery } from '../../../../hooks/useWorkspaces';
import { getUserSessionLabel } from '../../workspaces/services/sessionPresentation';

export function useOpenSession() {
  const isUserThread = Boolean(useMatch('/factories/:factoryId/user/threads/:threadId'));
  const sessionQuery = useUserSessionQuery(useRouteSessionId());
  const session = sessionQuery.data;

  return {
    session,
    isUserThread,
    title: session && isUserThread ? getUserSessionLabel(session) : session?.title?.trim() || undefined,
    loading: sessionQuery.isLoading,
  };
}
