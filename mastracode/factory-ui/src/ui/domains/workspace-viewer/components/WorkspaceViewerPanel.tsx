import { useState } from 'react';

import { useWorkspaceChanges, useWorkspaceFile } from '../../../../hooks/use-fs';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useUserSessionQuery } from '../../../../hooks/useWorkspaces';
import type { WorkspacePanelSize } from '../layout';
import type { RepositoryProviders } from './changes/tree/change-tree';
import { WorkspaceChangesPanel } from './WorkspaceChangesPanel';
import { WorkspaceFileBrowser } from './WorkspaceFileBrowser';
import { WorkspaceFileViewer } from './WorkspaceFileViewer';
import { WorkspaceOverview } from './WorkspaceOverview';
import { selectWorkspaceFilePreview } from './workspace-file-preview';

interface WorkspaceViewerPanelProps {
  workspacePath: string;
  onSizeChange?: (size: WorkspacePanelSize) => void;
  visible?: boolean;
  factoryProjectId?: string;
  /** The Factory session this workspace belongs to; enables session actions such as recreating the sandbox. */
  sessionId?: string;
}

type WorkspacePanelView =
  | { type: 'overview' }
  | { type: 'files'; selectedPath?: string }
  | { type: 'file'; path: string }
  | { type: 'changes' };

export function WorkspaceViewerPanel({
  workspacePath,
  onSizeChange,
  visible = true,
  factoryProjectId,
  sessionId,
}: WorkspaceViewerPanelProps) {
  const session = useUserSessionQuery(sessionId);
  const canRecreateSandbox = session.data?.capabilities?.recreateSandbox === true;
  const [view, setView] = useState<WorkspacePanelView>({ type: 'overview' });
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [showHidden, setShowHidden] = useState(false);
  const selectedFilePath = view.type === 'file' ? view.path : undefined;
  const changes = useWorkspaceChanges(workspacePath, { enabled: visible });
  const factory = useFactoryQuery(factoryProjectId);
  const repositoryProviders: RepositoryProviders | undefined = factory.data
    ? Object.fromEntries(factory.data.repositories.map(repo => [repo.slug.toLowerCase(), repo.provider]))
    : undefined;
  const file = useWorkspaceFile(workspacePath, selectedFilePath, {
    enabled: visible && view.type === 'file',
    select: selectWorkspaceFilePreview,
  });

  const showOverview = () => {
    setView({ type: 'overview' });
    onSizeChange?.('compact');
  };
  const showView = (type: 'files' | 'changes') => {
    setView({ type });
    onSizeChange?.('full');
  };
  if (view.type === 'changes') {
    return (
      <WorkspaceChangesPanel
        workspacePath={workspacePath}
        visible={visible}
        repositoryProviders={repositoryProviders}
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
        workspacePath={workspacePath}
        visible={visible}
        selectedFilePath={view.selectedPath}
        onFileSelect={path => setView({ type: 'file', path })}
        openFolders={openFolders}
        showHidden={showHidden}
        onShowHiddenChange={setShowHidden}
        onFolderOpenChange={(path, open) => setOpenFolders(previous => ({ ...previous, [path]: open }))}
        onBack={showOverview}
      />
    );
  }

  return (
    <WorkspaceOverview
      changes={changes.data}
      changesLoading={changes.isLoading}
      changesError={changes.error ?? undefined}
      onShowFiles={() => showView('files')}
      onShowChanges={() => showView('changes')}
      recreateSandbox={
        canRecreateSandbox && sessionId ? { sessionId, factoryId: factoryProjectId, workspacePath } : undefined
      }
    />
  );
}
