import { useMatch, useParams } from 'react-router';

import { useUserSessionQuery } from '../../../../hooks/useWorkspaces';
import { useWorkspacePanel } from '../context/useWorkspacePanel';
import { overviewScrollClass } from '../layout';
import { WorkspaceOverviewSkeleton } from './WorkspaceOverviewSkeleton';
import { WorkspaceViewerPanel } from './WorkspaceViewerPanel';

export function WorkspaceFilesContent() {
  const { open, workspacePath, threadId, setSize, readsChanges, summary } = useWorkspacePanel();
  const { factoryId, sessionId } = useParams<{ factoryId: string; sessionId: string }>();
  // User sessions route as user/threads/:threadId, where the thread segment is the session id.
  const userThreadMatch = useMatch('/factories/:factoryId/user/threads/:threadId');
  const viewedSessionId = sessionId ?? userThreadMatch?.params.threadId;
  const session = useUserSessionQuery(viewedSessionId);
  if (!workspacePath || !threadId) return null;
  if (session.isPending) {
    return (
      <div className={overviewScrollClass}>
        {summary}
        <WorkspaceOverviewSkeleton />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 grow flex-col overflow-hidden" data-testid="workspace-viewer-panel">
      <WorkspaceViewerPanel
        key={`${workspacePath}|${threadId}`}
        workspacePath={workspacePath}
        onSizeChange={setSize}
        visible={open}
        readsChanges={readsChanges}
        factoryProjectId={factoryId}
        sessionId={viewedSessionId}
        summary={summary}
      />
    </div>
  );
}
