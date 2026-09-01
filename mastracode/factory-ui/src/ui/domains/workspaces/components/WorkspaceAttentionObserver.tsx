import { useMatch } from 'react-router';

import { useSessionRunObserver } from '../../../../hooks/useWorkspaceAttention';
import { allSessionRows, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';

export function WorkspaceAttentionObserver({ projectRepositoryId }: { projectRepositoryId: string | undefined }) {
  // `useParams` above the thread routes can't see their params, so match them
  // explicitly. Whatever door opened the session — sidebar row, board card,
  // deep link — landing on its route is what dismisses its attention mark.
  const workspaceMatch = useMatch('/factories/:factoryId/workspaces/:sessionId/*');
  const userThreadMatch = useMatch('/factories/:factoryId/user/threads/:threadId');
  const openSessionId = workspaceMatch?.params.sessionId ?? userThreadMatch?.params.threadId;
  const sessions = useWorkspacesQuery(projectRepositoryId);
  useSessionRunObserver({
    sessions: allSessionRows(sessions.data),
    openSessionId,
    ready: sessions.isSuccess,
  });
  return null;
}
