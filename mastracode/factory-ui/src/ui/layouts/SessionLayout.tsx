import { Navigate, Outlet, useParams } from 'react-router';

import { SessionNotFound } from '../domains/chat/components/SessionNotFound';
import { ChatSessionBoundary } from '../domains/chat/context/ChatSessionProvider';
import { failedDraftState } from '../domains/chat/services/handoffFiles';
import { SessionRouteFrame } from '../domains/factory/components/SessionRouteFrame';
import { useThreadWorkspacePath } from '../domains/workspace-viewer/hooks/useThreadWorkspacePath';
import { DraftSessionCreateError, isSessionNotFound } from '../domains/workspaces/services/user-sessions';

export function SessionLayout() {
  const { factoryId, threadId } = useParams<{ factoryId: string; threadId?: string }>();
  const { error } = useThreadWorkspacePath();

  if (error instanceof DraftSessionCreateError) {
    return <Navigate replace to={error.draftPath} state={failedDraftState(error.draft, error.message)} />;
  }
  if (error && isSessionNotFound(error)) return <SessionNotFound factoryId={factoryId} />;

  return (
    <ChatSessionBoundary threadId={threadId}>
      <SessionRouteFrame>
        <Outlet />
      </SessionRouteFrame>
    </ChatSessionBoundary>
  );
}
