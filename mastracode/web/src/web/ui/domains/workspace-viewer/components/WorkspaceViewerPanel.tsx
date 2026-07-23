import { Button } from '@mastra/playground-ui/components/Button';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

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

export function WorkspaceViewerPanel({ workspacePath, renderedPaths, ...props }: WorkspaceViewerPanelProps) {
  const resetKey = [workspacePath, ...renderedPaths.map(path => `${path.id}:${path.root}`)].join('|');

  return (
    <WorkspaceViewerPanelInner key={resetKey} workspacePath={workspacePath} renderedPaths={renderedPaths} {...props} />
  );
}

function WorkspaceViewerPanelInner({
  workspacePath,
  renderedPaths,
  title,
  context,
  onExpandedChange,
}: WorkspaceViewerPanelProps) {
  const [selectedRenderedPathId, setSelectedRenderedPathId] = useState(renderedPaths[0]?.id ?? '');
  const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>();
  const [viewerOpen, setViewerOpenState] = useState(false);
  const [browserWidth, setBrowserWidth] = useState(320);
  const resizeCleanupRef = useRef<(() => void) | undefined>(undefined);

  const selectedRenderedPath = renderedPaths.find(path => path.id === selectedRenderedPathId) ?? renderedPaths[0];
  const selectedFileRequestPath = selectedFilePath ? `${selectedRenderedPath?.root}/${selectedFilePath}` : undefined;
  const listing = useWorkspaceRenderedListing(workspacePath, selectedRenderedPath?.root);
  const file = useWorkspaceFile(workspacePath, selectedFileRequestPath, { enabled: viewerOpen });

  useEffect(() => () => resizeCleanupRef.current?.(), []);

  if (!selectedRenderedPath) return null;

  const setViewerOpen = (open: boolean) => {
    setViewerOpenState(open);
    onExpandedChange?.(open);
  };

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    resizeCleanupRef.current?.();
    const startX = event.clientX;
    const startWidth = browserWidth;
    const onPointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth - (moveEvent.clientX - startX);
      setBrowserWidth(Math.min(420, Math.max(220, nextWidth)));
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
      resizeCleanupRef.current = undefined;
    };
    resizeCleanupRef.current = cleanup;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
  };

  return (
    <div className="relative flex h-full w-full min-w-0 rounded-xl bg-surface3" data-testid="workspace-viewer-panel">
      {viewerOpen ? (
        <div className="relative h-full min-w-0 flex-1 overflow-hidden">
          <Button
            size="icon-sm"
            variant="ghost"
            className="absolute left-2 top-2 z-10 lg:hidden"
            onClick={() => setViewerOpen(false)}
            aria-label="Back to workspace files"
          >
            <ArrowLeft />
          </Button>
          <WorkspaceFileViewer
            filePath={selectedFilePath}
            file={file.data}
            isLoading={file.isLoading}
            error={file.error instanceof Error ? file.error : undefined}
          />
        </div>
      ) : null}
      {viewerOpen ? (
        <div
          className="hidden w-1 cursor-col-resize bg-border1 hover:bg-accent1 lg:block"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize workspace file browser"
          onPointerDown={startResize}
        />
      ) : null}
      <div
        className={
          viewerOpen
            ? 'hidden h-full min-w-0 shrink-0 overflow-hidden lg:block'
            : 'h-full min-w-0 flex-1 overflow-hidden'
        }
        style={viewerOpen ? { width: browserWidth } : undefined}
      >
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
