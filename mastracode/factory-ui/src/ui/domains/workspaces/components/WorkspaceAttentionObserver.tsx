import { useQueryClient } from '@tanstack/react-query';
import { useMatch } from 'react-router';

import { queryKeys } from '../../../../api/keys';
import { useActiveRunResources } from '../../../../hooks/useActiveRunResources';
import { useWorkspaceAttention } from '../../../../hooks/useWorkspaceAttention';
import { useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';

export function WorkspaceAttentionObserver({ projectRepositoryId }: { projectRepositoryId: string | undefined }) {
  const queryClient = useQueryClient();
  // `useParams` above the thread routes can't see their params, so match them
  // explicitly. Whatever door opened the session — sidebar row, board card,
  // deep link — landing on its route is what dismisses its attention mark.
  const workspaceMatch = useMatch('/factories/:factoryId/workspaces/:sessionId/*');
  const userThreadMatch = useMatch('/factories/:factoryId/user/threads/:threadId');
  const openSessionId = workspaceMatch?.params.sessionId ?? userThreadMatch?.params.threadId;
  const sessions = useWorkspacesQuery(projectRepositoryId);
  const factorySessions = sessions.data?.workspaces ?? [];
  const userSessions = sessions.data?.userSessions ?? [];
  const runningBySessionId = useActiveRunResources({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceIds: [...factorySessions, ...userSessions].map(session => session.sessionId),
  });
  const factoryRunning = Object.fromEntries(
    factorySessions.map(session => [session.sessionId, runningBySessionId[session.sessionId] === true]),
  );
  const userRunning = Object.fromEntries(
    userSessions.map(session => [session.sessionId, runningBySessionId[session.sessionId] === true]),
  );
  const refreshSessions = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(projectRepositoryId) });

  useWorkspaceAttention({
    projectRepositoryId,
    sessionKind: 'factory',
    runningByPath: factoryRunning,
    ready: sessions.isSuccess,
    openPath: openSessionId,
    onRunsFinished: refreshSessions,
  });
  useWorkspaceAttention({
    projectRepositoryId,
    sessionKind: 'user',
    runningByPath: userRunning,
    ready: sessions.isSuccess,
    openPath: openSessionId,
    onRunsFinished: refreshSessions,
  });
  return null;
}
