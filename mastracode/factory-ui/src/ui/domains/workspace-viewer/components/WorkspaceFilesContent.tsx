import { useWorkspacePanel } from '../context/useWorkspacePanel';
import { WorkspaceViewerPanel } from './WorkspaceViewerPanel';

export function WorkspaceFilesContent() {
  const { open, workspacePath, threadId, setExpanded } = useWorkspacePanel();
  if (!workspacePath || !threadId) return null;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden" data-testid="workspace-viewer-panel">
      <WorkspaceViewerPanel
        key={`${workspacePath}|${threadId}`}
        workspacePath={workspacePath}
        threadId={threadId}
        onExpandedChange={setExpanded}
        visible={open}
      />
    </div>
  );
}
