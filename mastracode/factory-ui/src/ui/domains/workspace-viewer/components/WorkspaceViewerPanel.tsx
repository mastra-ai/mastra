import { useState } from 'react';

import { useWorkspaceFile, useWorkspaceRenderedListing } from '../../../../hooks/use-fs';
import type { RenderedWorkspacePath } from '../config';
import { WorkspaceChangesPanel } from './WorkspaceChangesPanel';
import { WorkspaceFileBrowser } from './WorkspaceFileBrowser';
import { WorkspaceFileViewer } from './WorkspaceFileViewer';
import { WorkspacePreviewDrawer } from './WorkspacePreviewDrawer';

interface WorkspaceViewerPanelProps {
  workspacePath: string;
  renderedPaths: RenderedWorkspacePath[];
  title?: string;
  context?: string;
}

export function WorkspaceViewerPanel({ workspacePath, renderedPaths, ...props }: WorkspaceViewerPanelProps) {
  const resetKey = [workspacePath, ...renderedPaths.map(path => `${path.id}:${path.root}`)].join('|');
  return (
    <WorkspaceViewerPanelReset key={resetKey} workspacePath={workspacePath} renderedPaths={renderedPaths} {...props} />
  );
}

function WorkspaceViewerPanelReset(props: WorkspaceViewerPanelProps) {
  const [view, setView] = useState<'files' | 'changes'>('files');

  if (view === 'changes') {
    return <WorkspaceChangesPanel workspacePath={props.workspacePath} onShowFiles={() => setView('files')} />;
  }
  return <WorkspaceViewerPanelInner {...props} onShowChanges={() => setView('changes')} />;
}

function WorkspaceViewerPanelInner({
  workspacePath,
  renderedPaths,
  title,
  context,
  onShowChanges,
}: WorkspaceViewerPanelProps & { onShowChanges: () => void }) {
  const [selectedRenderedPathId, setSelectedRenderedPathId] = useState(renderedPaths[0]?.id ?? '');
  const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>();
  const [viewerOpen, setViewerOpen] = useState(false);

  const selectedRenderedPath = renderedPaths.find(path => path.id === selectedRenderedPathId) ?? renderedPaths[0];
  const selectedFileRequestPath = selectedFilePath ? `${selectedRenderedPath?.root}/${selectedFilePath}` : undefined;
  const listing = useWorkspaceRenderedListing(workspacePath, selectedRenderedPath?.root);
  const file = useWorkspaceFile(workspacePath, selectedFileRequestPath, { enabled: viewerOpen });
  const selectedFile = file.data?.path === selectedFileRequestPath ? file.data : undefined;

  if (!selectedRenderedPath) return null;

  return (
    <div className="bg-surface1 relative flex h-full w-full min-w-0" data-testid="workspace-viewer-panel">
      <div className="sr-only">
        {title ?? 'Workspace viewer'} {context ?? ''}
      </div>
      <WorkspaceFileBrowser
        renderedPaths={renderedPaths}
        selectedPath={selectedRenderedPath}
        selectedFilePath={selectedFilePath}
        listing={listing.data}
        isLoading={listing.isLoading}
        isRefreshing={listing.isFetching}
        error={listing.error instanceof Error ? listing.error : undefined}
        onRenderedPathChange={path => {
          setSelectedRenderedPathId(path.id);
          setSelectedFilePath(undefined);
          setViewerOpen(false);
        }}
        onFileSelect={filePath => {
          setSelectedFilePath(filePath);
          setViewerOpen(true);
        }}
        onRefresh={() => listing.refetch()}
        onShowChanges={onShowChanges}
      />
      <WorkspacePreviewDrawer
        title={selectedFilePath ?? 'Workspace file preview'}
        description="Preview a file from the session workspace."
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      >
        <WorkspaceFileViewer
          key={selectedFileRequestPath}
          filePath={selectedFilePath}
          file={selectedFile}
          isLoading={file.isLoading || (file.isFetching && !selectedFile)}
          error={file.error instanceof Error ? file.error : undefined}
        />
      </WorkspacePreviewDrawer>
    </div>
  );
}
