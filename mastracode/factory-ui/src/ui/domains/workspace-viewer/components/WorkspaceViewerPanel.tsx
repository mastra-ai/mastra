import { useState } from 'react';
import type { ReactNode } from 'react';

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
  /** False keeps the overview from reading changes, which would wake an idle sandbox. */
  readsChanges?: boolean;
  factoryProjectId?: string;
  /** The Factory session this workspace belongs to; enables session actions such as recreating the sandbox. */
  sessionId?: string;
  /** What the page shows above the overview; the files and changes views take the whole card. */
  summary?: ReactNode;
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
  readsChanges = true,
  factoryProjectId,
  sessionId,
  summary,
}: WorkspaceViewerPanelProps) {
  const session = useUserSessionQuery(sessionId);
  const canRecreateSandbox = session.data?.capabilities?.recreateSandbox === true;
  const [view, setView] = useState<WorkspacePanelView>({ type: 'overview' });
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [showHidden, setShowHidden] = useState(false);
  const selectedFilePath = view.type === 'file' ? view.path : undefined;
  // Opening files or changes reads the sandbox, so it is awake by the time the viewer comes back
  // to the overview, which may then show the change counts without waking anything.
  const [visitedSandbox, setVisitedSandbox] = useState(false);
  const changes = useWorkspaceChanges(workspacePath, { enabled: visible && (readsChanges || visitedSandbox) });
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
    setVisitedSandbox(true);
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
      summary={summary}
    />
  );
}
