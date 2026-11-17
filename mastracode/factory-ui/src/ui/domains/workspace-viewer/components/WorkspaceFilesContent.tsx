import { useParams } from 'react-router';

import { useRouteSessionId } from '../../../../hooks/useRouteSessionId';
import { workspacePanelKey } from '../context/WorkspacePanelContext';
import { useWorkspacePanel } from '../context/useWorkspacePanel';
import type { WorkspacePanelSize } from '../layout';
import { WorkspaceViewerPanel } from './WorkspaceViewerPanel';

export function WorkspaceFilesContent({
  visible,
  onSizeChange,
}: {
  visible: boolean;
  onSizeChange: (size: WorkspacePanelSize) => void;
}) {
  const panel = useWorkspacePanel();
  const { workspacePath, threadId, readsChanges, page } = panel;
  const { factoryId } = useParams<{ factoryId: string }>();
  const sessionId = useRouteSessionId();
  if (!workspacePath || !threadId) return null;

  return (
    <div className="flex min-h-0 w-full min-w-0 grow flex-col overflow-hidden" data-testid="workspace-viewer-panel">
      <WorkspaceViewerPanel
        key={workspacePanelKey(panel)}
        workspacePath={workspacePath}
        onSizeChange={onSizeChange}
        visible={visible}
        readsChanges={readsChanges}
        factoryProjectId={factoryId}
        sessionId={sessionId}
        page={page}
      />
    </div>
  );
}
