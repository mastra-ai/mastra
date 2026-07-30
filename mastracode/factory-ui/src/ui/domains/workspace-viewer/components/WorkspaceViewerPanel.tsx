import { useState } from 'react';

import { useWorkspaceFile, useWorkspaceRenderedListing } from '../../../../hooks/use-fs';
import type { RenderedWorkspacePath } from '../config';
import { WorkspaceFileBrowser } from './WorkspaceFileBrowser';
import { WorkspaceFileViewer } from './WorkspaceFileViewer';

interface WorkspaceViewerPanelProps {
  workspacePath: string;
  renderedPaths: RenderedWorkspacePath[];
  /** Fires when the file viewer opens or closes, so a floating host can widen its surface. */
  onExpandedChange?: (expanded: boolean) => void;
}

export function WorkspaceViewerPanel({ workspacePath, renderedPaths, ...props }: WorkspaceViewerPanelProps) {
  const resetKey = [workspacePath, ...renderedPaths.map(path => `${path.id}:${path.root}`)].join('|');

  return (
    <WorkspaceViewerPanelInner key={resetKey} workspacePath={workspacePath} renderedPaths={renderedPaths} {...props} />
  );
}

function WorkspaceViewerPanelInner({ workspacePath, renderedPaths, onExpandedChange }: WorkspaceViewerPanelProps) {
  const [selectedRenderedPathId, setSelectedRenderedPathId] = useState(renderedPaths[0]?.id ?? '');
  const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>();
  const [viewerOpen, setViewerOpenState] = useState(false);

  const selectedRenderedPath = renderedPaths.find(path => path.id === selectedRenderedPathId) ?? renderedPaths[0];
  const selectedFileRequestPath = selectedFilePath ? `${selectedRenderedPath?.root}/${selectedFilePath}` : undefined;
  const listing = useWorkspaceRenderedListing(workspacePath, selectedRenderedPath?.root);
  const file = useWorkspaceFile(workspacePath, selectedFileRequestPath, { enabled: viewerOpen });

  if (!selectedRenderedPath) return null;

  const setViewerOpen = (open: boolean) => {
    setViewerOpenState(open);
    onExpandedChange?.(open);
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden" data-testid="workspace-viewer-panel">
      {viewerOpen ? (
        <WorkspaceFileViewer
          filePath={selectedFilePath}
          file={file.data}
          isLoading={file.isLoading}
          error={file.error instanceof Error ? file.error : undefined}
          onBack={() => setViewerOpen(false)}
        />
      ) : (
        <WorkspaceFileBrowser
          renderedPaths={renderedPaths}
          selectedPath={selectedRenderedPath}
          selectedFilePath={selectedFilePath}
          listing={listing.data}
          isLoading={listing.isLoading}
          error={listing.error instanceof Error ? listing.error : undefined}
          onRefresh={() => listing.refetch()}
          onRenderedPathChange={path => {
            setSelectedRenderedPathId(path.id);
            setSelectedFilePath(undefined);
            setViewerOpen(false);
          }}
          onFileSelect={filePath => {
            setSelectedFilePath(filePath);
            setViewerOpen(true);
          }}
        />
      )}
    </div>
  );
}
