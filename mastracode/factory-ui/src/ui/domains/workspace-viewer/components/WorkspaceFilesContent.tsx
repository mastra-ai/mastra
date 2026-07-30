import { renderedPaths } from '../config';
import { useWorkspaceFiles } from '../context/useWorkspaceFiles';
import { WorkspaceViewerPanel } from './WorkspaceViewerPanel';

export function WorkspaceFilesContent() {
  const { workspacePath, setViewingFile } = useWorkspaceFiles();
  if (!workspacePath) return null;

  return (
    <WorkspaceViewerPanel
      workspacePath={workspacePath}
      renderedPaths={renderedPaths}
      onExpandedChange={setViewingFile}
    />
  );
}
