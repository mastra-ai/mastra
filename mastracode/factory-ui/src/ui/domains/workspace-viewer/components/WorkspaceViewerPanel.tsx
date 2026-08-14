import { useState } from 'react';

import { useWorkspaceFile, useWorkspaceFiles } from '../../../../hooks/use-fs';
import { WorkspaceChangesPanel } from './WorkspaceChangesPanel';
import { WorkspaceFileBrowser } from './WorkspaceFileBrowser';
import { WorkspaceFileViewer } from './WorkspaceFileViewer';

interface WorkspaceViewerPanelProps {
  workspacePath: string;
  threadId: string;
  /** Fires when the file viewer opens or closes, so a floating host can widen its surface. */
  onExpandedChange?: (expanded: boolean) => void;
  /** A host that keeps the panel mounted off-screen passes false to keep queries dormant. */
  visible?: boolean;
}

export function WorkspaceViewerPanel({ workspacePath, threadId, visible = true, ...props }: WorkspaceViewerPanelProps) {
  return (
    <WorkspaceViewerPanelReset
      key={`${workspacePath}|${threadId}`}
      workspacePath={workspacePath}
      threadId={threadId}
      visible={visible}
      {...props}
    />
  );
}

type MountedPanelProps = Omit<WorkspaceViewerPanelProps, 'visible'> & { visible: boolean };

function WorkspaceViewerPanelReset(props: MountedPanelProps) {
  const [view, setView] = useState<'files' | 'changes'>('files');

  if (view === 'changes') {
    return (
      <WorkspaceChangesPanel
        workspacePath={props.workspacePath}
        visible={props.visible}
        onShowFiles={() => setView('files')}
      />
    );
  }

  return <WorkspaceViewerPanelInner {...props} onShowChanges={() => setView('changes')} />;
}

function WorkspaceViewerPanelInner({
  workspacePath,
  threadId,
  onExpandedChange,
  onShowChanges,
  visible,
}: MountedPanelProps & { onShowChanges: () => void }) {
  const [selectedFilePath, setSelectedFilePath] = useState<string | undefined>();
  const [viewerOpen, setViewerOpenState] = useState(false);
  const listing = useWorkspaceFiles(workspacePath, threadId, { enabled: visible });
  const file = useWorkspaceFile(workspacePath, selectedFilePath, threadId, { enabled: visible && viewerOpen });
  const selectedFile = file.data?.path === selectedFilePath ? file.data : undefined;

  const setViewerOpen = (open: boolean) => {
    setViewerOpenState(open);
    onExpandedChange?.(open);
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden" data-testid="workspace-viewer-panel">
      {viewerOpen ? (
        <WorkspaceFileViewer
          key={selectedFilePath}
          filePath={selectedFilePath}
          file={selectedFile}
          isLoading={file.isLoading || (file.isFetching && !selectedFile)}
          error={file.error instanceof Error ? file.error : undefined}
          onBack={() => setViewerOpen(false)}
        />
      ) : (
        <WorkspaceFileBrowser
          files={listing.data?.files}
          selectedFilePath={selectedFilePath}
          isLoading={listing.isLoading}
          isRefreshing={listing.isFetching}
          error={listing.error instanceof Error ? listing.error : undefined}
          onRefresh={() => listing.refetch()}
          onFileSelect={filePath => {
            setSelectedFilePath(filePath);
            setViewerOpen(true);
          }}
          onShowChanges={onShowChanges}
        />
      )}
    </div>
  );
}
