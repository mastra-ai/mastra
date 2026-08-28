import { useParams } from 'react-router';

import { useThreadWorkItem } from '../../../../hooks/useThreadWorkItem';
import { useWorkspacePanel } from '../context/useWorkspacePanel';
import { WorkspaceViewerPanel } from './WorkspaceViewerPanel';

export function WorkspaceFilesContent() {
  const { open, workspacePath, threadId, setExpanded } = useWorkspacePanel();
  const { factoryId, sessionId } = useParams<{ factoryId: string; sessionId: string }>();
  const workItem = useThreadWorkItem(factoryId, threadId, sessionId);
  if (!workspacePath || !threadId) return null;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden" data-testid="workspace-viewer-panel">
      <WorkspaceViewerPanel
        key={`${workspacePath}|${threadId}`}
        workspacePath={workspacePath}
        threadId={threadId}
        onExpandedChange={setExpanded}
        visible={open}
        workItem={workItem.data}
        factoryProjectId={factoryId}
      />
    </div>
  );
}
