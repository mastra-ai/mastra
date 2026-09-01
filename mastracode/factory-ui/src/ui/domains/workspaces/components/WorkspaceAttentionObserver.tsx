import { useMatch } from 'react-router';

import { useSessionRunObserver } from '../../../../hooks/useWorkspaceAttention';
import { useWorkspacesQuery } from '../../../../hooks/useWorkspaces';

export function WorkspaceAttentionObserver({ projectRepositoryId }: { projectRepositoryId: string | undefined }) {
  // `useParams` above the thread routes can't see their params, so match them
  // explicitly. Whatever door opened the session — sidebar row, board card,
  // deep link — landing on its route is what dismisses its attention mark.
  const workspaceMatch = useMatch('/factories/:factoryId/workspaces/:sessionId/*');
  const userThreadMatch = useMatch('/factories/:factoryId/user/threads/:threadId');
  const openSessionId = workspaceMatch?.params.sessionId ?? userThreadMatch?.params.threadId;
  const sessions = useWorkspacesQuery(projectRepositoryId);
  useSessionRunObserver({
    sessions: [...(sessions.data?.workspaces ?? []), ...(sessions.data?.userSessions ?? [])],
    openSessionId,
    ready: sessions.isSuccess,
  });
  return null;
}
