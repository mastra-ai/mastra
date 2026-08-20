import { useState } from 'react';

import { useWorkspaceChanges, useWorkspaceFile, useWorkspaceFiles } from '../../../../hooks/use-fs';
import { WorkspaceChangesPanel } from './WorkspaceChangesPanel';
import { WorkspaceFileBrowser } from './WorkspaceFileBrowser';
import { WorkspaceFileViewer } from './WorkspaceFileViewer';
import { WorkspaceOverview } from './WorkspaceOverview';
import { selectWorkspaceFilePreview } from './workspace-file-preview';

interface WorkspaceViewerPanelProps {
  workspacePath: string;
  threadId: string;
  onExpandedChange?: (expanded: boolean) => void;
  visible?: boolean;
}

type WorkspacePanelView =
  | { type: 'overview' }
  | { type: 'files'; selectedPath?: string }
  | { type: 'file'; path: string }
  | { type: 'changes' };

export function WorkspaceViewerPanel({
  workspacePath,
  threadId,
  onExpandedChange,
  visible = true,
}: WorkspaceViewerPanelProps) {
  const [view, setView] = useState<WorkspacePanelView>({ type: 'overview' });
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const selectedFilePath = view.type === 'file' ? view.path : undefined;
  const listing = useWorkspaceFiles(workspacePath, threadId, { enabled: visible });
  const changes = useWorkspaceChanges(workspacePath, { enabled: visible });
  const file = useWorkspaceFile(workspacePath, selectedFilePath, threadId, {
    enabled: visible && view.type === 'file',
    select: selectWorkspaceFilePreview,
  });

  const showOverview = () => {
    setView({ type: 'overview' });
    onExpandedChange?.(false);
  };
  const showView = (type: 'files' | 'changes') => {
    setView({ type });
    onExpandedChange?.(true);
  };

  if (view.type === 'changes') {
    return (
      <WorkspaceChangesPanel
        workspacePath={workspacePath}
        visible={visible}
        changes={changes.data}
        isLoading={changes.isLoading}
        isRefreshing={changes.isFetching}
        error={changes.error ?? undefined}
        onRefresh={() => changes.refetch()}
        onBack={showOverview}
      />
    );
  }

  if (view.type === 'file') {
    return (
      <WorkspaceFileViewer
        filePath={view.path}
        file={file.data}
        isLoading={file.isLoading || (file.isFetching && !file.data)}
        isRefreshing={file.isFetching}
        error={file.error ?? undefined}
        onRefresh={() => file.refetch()}
        onBack={() => setView({ type: 'files', selectedPath: view.path })}
      />
    );
  }

  if (view.type === 'files') {
    return (
      <WorkspaceFileBrowser
        files={listing.data?.files}
        selectedFilePath={view.selectedPath}
        isLoading={listing.isLoading}
        isRefreshing={listing.isFetching}
        error={listing.error ?? undefined}
        onRefresh={() => listing.refetch()}
        onFileSelect={path => setView({ type: 'file', path })}
        openFolders={openFolders}
        onFolderOpenChange={(path, open) => setOpenFolders(previous => ({ ...previous, [path]: open }))}
        onBack={showOverview}
      />
    );
  }

  return (
    <WorkspaceOverview
      listing={listing.data}
      changes={changes.data}
      filesLoading={listing.isLoading}
      changesLoading={changes.isLoading}
      filesError={listing.error ?? undefined}
      changesError={changes.error ?? undefined}
      onShowFiles={() => showView('files')}
      onShowChanges={() => showView('changes')}
    />
  );
}
