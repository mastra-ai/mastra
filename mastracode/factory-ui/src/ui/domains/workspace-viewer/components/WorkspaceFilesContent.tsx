import { useParams } from 'react-router';

import { useThreadWorkItem } from '../../../../hooks/useThreadWorkItem';
import { useWorkspacePanel } from '../context/useWorkspacePanel';
import { WorkspaceViewerPanel } from './WorkspaceViewerPanel';

export function WorkspaceFilesContent() {
  const { open, workspacePath, threadId, setSize } = useWorkspacePanel();
  const { factoryId, sessionId } = useParams<{ factoryId: string; sessionId: string }>();
  const workItem = useThreadWorkItem(factoryId, threadId, sessionId);
  if (!workspacePath || !threadId) return null;

  return (
    <div className="flex min-h-0 w-full min-w-0 grow flex-col overflow-hidden" data-testid="workspace-viewer-panel">
      <WorkspaceViewerPanel
        key={`${workspacePath}|${threadId}`}
        workspacePath={workspacePath}
        threadId={threadId}
        onSizeChange={setSize}
        visible={open}
        workItem={workItem.data}
        factoryProjectId={factoryId}
      />
    </div>
  );
}
