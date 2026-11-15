import { useMatch, useParams } from 'react-router';

import { workspacePanelKey } from '../context/WorkspacePanelContext';
import { useWorkspacePanel } from '../context/useWorkspacePanel';
import type { WorkspacePanelSize } from '../layout';
import { WorkspaceViewerPanel } from './WorkspaceViewerPanel';

export function WorkspaceFilesContent({ onSizeChange }: { onSizeChange: (size: WorkspacePanelSize) => void }) {
  const panel = useWorkspacePanel();
  const { open, workspacePath, threadId, readsChanges, page } = panel;
  const { factoryId, sessionId } = useParams<{ factoryId: string; sessionId: string }>();
  // User sessions route as user/threads/:threadId, where the thread segment is the session id.
  const userThreadMatch = useMatch('/factories/:factoryId/user/threads/:threadId');
  if (!workspacePath || !threadId) return null;

  return (
    <div className="flex min-h-0 w-full min-w-0 grow flex-col overflow-hidden" data-testid="workspace-viewer-panel">
      <WorkspaceViewerPanel
        key={workspacePanelKey(panel)}
        workspacePath={workspacePath}
        onSizeChange={onSizeChange}
        visible={open}
        readsChanges={readsChanges}
        factoryProjectId={factoryId}
        sessionId={sessionId ?? userThreadMatch?.params.threadId}
        page={page}
      />
    </div>
  );
}
