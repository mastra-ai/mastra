import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../api/keys';
import { useActiveRunResources } from '../../../../hooks/useActiveRunResources';
import { useWorkspaceAttention } from '../../../../hooks/useWorkspaceAttention';
import { useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';

export function WorkspaceAttentionObserver({ projectRepositoryId }: { projectRepositoryId: string | undefined }) {
  const queryClient = useQueryClient();
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
    onRunsFinished: refreshSessions,
  });
  useWorkspaceAttention({
    projectRepositoryId,
    sessionKind: 'user',
    runningByPath: userRunning,
    ready: sessions.isSuccess,
    onRunsFinished: refreshSessions,
  });
  return null;
}
