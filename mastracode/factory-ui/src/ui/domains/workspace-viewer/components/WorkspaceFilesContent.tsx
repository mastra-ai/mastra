import { useWorkspaceFiles } from '../context/useWorkspaceFiles';
import { WorkspaceViewerPanel } from './WorkspaceViewerPanel';

export function WorkspaceFilesContent() {
  const { open, workspacePath, threadId, setViewingFile } = useWorkspaceFiles();
  if (!workspacePath || !threadId) return null;

  return (
    <WorkspaceViewerPanel
      workspacePath={workspacePath}
      threadId={threadId}
      onExpandedChange={setViewingFile}
      visible={open}
    />
  );
}
