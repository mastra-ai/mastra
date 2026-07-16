import { useEffect, useState } from 'react';

import { useWorkspaceFile, useWorkspaceRenderedListing } from '../../../../../shared/hooks/use-fs';
import type { RenderedWorkspacePath } from '../config';
import { WorkspaceFileBrowser } from './WorkspaceFileBrowser';
import { WorkspaceFileViewer } from './WorkspaceFileViewer';

interface WorkspaceViewerPanelProps {
  workspacePath: string;
  renderedPaths: RenderedWorkspacePath[];
  title?: string;
  context?: string;
  onExpandedChange?: (expanded: boolean) => void;
}

export function WorkspaceViewerPanel({
  workspacePath,
  renderedPaths,
  title,
  context,
  onExpandedChange,
}: WorkspaceViewerPanelProps) {
  const [selectedRenderedPathId, setSelectedRenderedPathId] = useState(renderedPaths[0]?.id ?? '');
  const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>();
  const [viewerOpen, setViewerOpen] = useState(false);
  const [browserWidth, setBrowserWidth] = useState(320);

  const selectedRenderedPath = renderedPaths.find(path => path.id === selectedRenderedPathId) ?? renderedPaths[0];
  const listing = useWorkspaceRenderedListing(workspacePath, selectedRenderedPath?.root);
  const file = useWorkspaceFile(workspacePath, selectedFilePath, { enabled: viewerOpen });

  useEffect(() => {
    setSelectedRenderedPathId(renderedPaths[0]?.id ?? '');
    setSelectedFilePath(undefined);
    setViewerOpen(false);
  }, [workspacePath, renderedPaths]);

  useEffect(() => {
    onExpandedChange?.(viewerOpen);
  }, [onExpandedChange, viewerOpen]);

  if (!selectedRenderedPath) return null;

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const startX = event.clientX;
    const startWidth = browserWidth;
    const onPointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth - (moveEvent.clientX - startX);
      setBrowserWidth(Math.min(420, Math.max(220, nextWidth)));
    };
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div className="hidden h-full w-full min-w-0 border-l border-border1 bg-surface1 lg:flex" data-testid="workspace-viewer-panel">
      {viewerOpen ? (
        <div className="h-full min-w-0 flex-1 overflow-hidden">
          <WorkspaceFileViewer
            filePath={selectedFilePath}
            file={file.data}
            isLoading={file.isLoading}
            error={file.error instanceof Error ? file.error : undefined}
            onClose={() => setViewerOpen(false)}
          />
        </div>
      ) : null}
      {viewerOpen ? (
        <div
          className="w-1 cursor-col-resize bg-border1 hover:bg-accent1"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize workspace file browser"
          onPointerDown={startResize}
        />
      ) : null}
      <div className="h-full min-w-0 shrink-0 overflow-hidden" style={{ width: browserWidth }}>
        <div className="sr-only">
          {title ?? 'Workspace viewer'} {context ?? ''}
        </div>
        <WorkspaceFileBrowser
          renderedPaths={renderedPaths}
          selectedPath={selectedRenderedPath}
          selectedFilePath={selectedFilePath}
          listing={listing.data}
          isLoading={listing.isLoading}
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
        />
      </div>
    </div>
  );
}
