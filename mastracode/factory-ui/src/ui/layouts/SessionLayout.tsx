import { Navigate, Outlet, useParams } from 'react-router';

import { SessionNotFound } from '../domains/chat/components/SessionNotFound';
import { ChatSessionBoundary } from '../domains/chat/context/ChatSessionProvider';
import { failedDraftState } from '../domains/chat/services/handoffFiles';
import { CardDraftFrame } from '../domains/factory/components/CardDraftFrame';
import { ThreadFrame } from '../domains/factory/components/ThreadFrame';
import { useThreadWorkspacePath } from '../domains/workspace-viewer/hooks/useThreadWorkspacePath';
import { DraftSessionCreateError, isSessionNotFound } from '../domains/workspaces/services/user-sessions';

export function SessionLayout() {
  const { factoryId, threadId, workItemId } = useParams<{
    factoryId: string;
    threadId?: string;
    workItemId?: string;
  }>();
  const { error } = useThreadWorkspacePath();

  if (error instanceof DraftSessionCreateError) {
    return <Navigate replace to={error.draftPath} state={failedDraftState(error.draft, error.message)} />;
  }
  if (error && isSessionNotFound(error)) return <SessionNotFound factoryId={factoryId} />;

  return (
    <ChatSessionBoundary threadId={threadId}>
      {workItemId ? (
        <CardDraftFrame workItemId={workItemId}>
          <Outlet />
        </CardDraftFrame>
      ) : (
        <ThreadFrame>
          <Outlet />
        </ThreadFrame>
      )}
    </ChatSessionBoundary>
  );
}
