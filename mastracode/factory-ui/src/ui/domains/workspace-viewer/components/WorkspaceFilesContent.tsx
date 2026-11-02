import { useMatch, useParams } from 'react-router';

import { useThreadWorkItem } from '../../../../hooks/useThreadWorkItem';
import { useWorkspacePanel } from '../context/useWorkspacePanel';
import { WorkspaceViewerPanel } from './WorkspaceViewerPanel';

export function WorkspaceFilesContent() {
  const { open, workspacePath, threadId, setSize } = useWorkspacePanel();
  const { factoryId, sessionId } = useParams<{ factoryId: string; sessionId: string }>();
  const workItem = useThreadWorkItem(factoryId, threadId, sessionId);
  // User sessions route as user/threads/:threadId, where the thread segment is the session id.
  const userThreadMatch = useMatch('/factories/:factoryId/user/threads/:threadId');
  const viewedSessionId = sessionId ?? userThreadMatch?.params.threadId;
  if (!workspacePath || !threadId) return null;

  return (
    <div className="flex min-h-0 w-full min-w-0 grow flex-col overflow-hidden" data-testid="workspace-viewer-panel">
      <WorkspaceViewerPanel
        key={`${workspacePath}|${threadId}`}
        workspacePath={workspacePath}
        onSizeChange={setSize}
        visible={open}
        workItem={workItem.data}
        factoryProjectId={factoryId}
        sessionId={viewedSessionId}
      />
    </div>
  );
}
