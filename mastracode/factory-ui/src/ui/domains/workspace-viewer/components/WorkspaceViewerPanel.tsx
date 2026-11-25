import { Button } from '@mastra/playground-ui/components/Button';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { memo, useState } from 'react';
import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';

import type { WorkspaceChanges, WorkspaceChangesScope } from '../../../../api/types';
import { useWorkspaceChanges, useWorkspaceFile } from '../../../../hooks/use-fs';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useUserSessionQuery } from '../../../../hooks/useWorkspaces';
import type { WorkspacePanelPage, WorkspaceSectionSlots } from '../context/WorkspacePanelContext';
import { overviewClass } from '../layout';
import type { WorkspacePanelSize } from '../layout';
import type { RepositoryProviders } from './changes/tree/change-tree';
import { PanelFrame } from './PanelFrame';
import { PanelSubject } from './PanelSubject';
import { RecreateSandboxAction } from './RecreateSandboxAction';
import { WorkspaceChangesPanel } from './WorkspaceChangesPanel';
import { WorkspaceFileBrowser } from './WorkspaceFileBrowser';
import { WorkspaceFileViewer } from './WorkspaceFileViewer';
import { WorkspaceSection } from './WorkspaceSection';
import type { WorkspaceChangesSummary } from './WorkspaceChangesCard';
import { selectWorkspaceFilePreview } from './workspace-file-preview';
import { unreadableRepositories } from './changes/unreadable-repositories';
import { IconChevronLeftMedium } from '@mastra/playground-ui/icons/central/IconChevronLeftMedium';

interface WorkspaceViewerPanelProps {
  workspacePath: string;
  onSizeChange?: (size: WorkspacePanelSize) => void;
  visible?: boolean;
  /** False keeps the overview from reading changes, which would wake an idle sandbox. */
  readsChanges?: boolean;
  factoryProjectId?: string;
  /** The Factory session this workspace belongs to; enables session actions such as recreating the sandbox. */
  sessionId?: string;
  page?: WorkspacePanelPage;
}

type WorkspacePanelView =
  | { type: 'overview'; returned?: boolean }
  | { type: 'files'; selectedPath?: string }
  | { type: 'file'; path: string }
  | { type: 'changes' };

const viewPanelClass = 'flex h-auto min-h-0 grow flex-col overflow-hidden';

function changesSummary(changes: UseQueryResult<WorkspaceChanges>): WorkspaceChangesSummary {
  if (changes.isLoading) return { state: 'loading' };
  if (changes.isError) return { state: 'failed' };
  return changes.data ? readSummary(changes.data) : { state: 'unread' };
}

function readSummary(data: WorkspaceChanges): WorkspaceChangesSummary {
  const unreadable = unreadableRepositories(data).length;
  if (!data.available) return { state: 'failed' };
  const repositories = data.repositories && {
    total: data.repositories.length,
    changed: data.repositories.filter(repository => repository.changes.length > 0).length,
    unreadable,
  };
  return {
    state: 'read',
    stats: { files: data.changes, additions: data.additions, deletions: data.deletions, repositories },
  };
}

function parentView(view: WorkspacePanelView): WorkspacePanelView | undefined {
  if (view.type === 'overview') return undefined;
  if (view.type === 'file') return { type: 'files', selectedPath: view.path };
  return { type: 'overview', returned: true };
}

export const WorkspaceViewerPanel = memo(function WorkspaceViewerPanel({
  workspacePath,
  onSizeChange,
  visible = true,
  readsChanges = true,
  factoryProjectId,
  sessionId,
  page,
}: WorkspaceViewerPanelProps) {
  const session = useUserSessionQuery(sessionId);
  const canRecreateSandbox = session.data?.capabilities?.recreateSandbox === true;
  const [view, setView] = useState<WorkspacePanelView>({ type: 'overview' });
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [showHidden, setShowHidden] = useState(false);
  const selectedFilePath = view.type === 'file' ? view.path : undefined;
  const [fileQuery, setFileQuery] = useState('');
  const [changesScope, setChangesScope] = useState<WorkspaceChangesScope>('branch');
  // Asking for changes or opening a view wakes the sandbox, so the overview may then read changes freely.
  const [wokeSandbox, setWokeSandbox] = useState(false);
  const changes = useWorkspaceChanges(workspacePath, { enabled: visible && (readsChanges || wokeSandbox) });
  const factory = useFactoryQuery(factoryProjectId);
  const repositoryProviders: RepositoryProviders | undefined = factory.data
    ? Object.fromEntries(factory.data.repositories.map(repo => [repo.slug.toLowerCase(), repo.provider]))
    : undefined;
  const file = useWorkspaceFile(workspacePath, selectedFilePath, {
    enabled: visible && view.type === 'file',
    select: selectWorkspaceFilePreview,
  });
  const changesState = changesSummary(changes);
  const noChanges =
    changesState.state === 'read' &&
    changesState.stats.files.length === 0 &&
    !changesState.stats.repositories?.unreadable;

  const show = (next: WorkspacePanelView) => {
    setView(next);
    if (next.type !== 'overview') setWokeSandbox(true);
    onSizeChange?.(next.type === 'overview' ? 'compact' : 'full');
  };
  const parent = parentView(view);
  const back = parent ? (
    <Button
      autoFocus
      size="icon-sm"
      variant="ghost"
      tooltip={parent.type === 'files' ? 'Back to files' : 'Back to overview'}
      onClick={() => show(parent)}
    >
      <IconChevronLeftMedium />
    </Button>
  ) : undefined;
  const workspace = ({ changeRequest, repository }: WorkspaceSectionSlots = {}) => (
    <WorkspaceSection
      loading={session.isLoading}
      workspace={
        session.data
          ? {
              branch: session.data.branch,
              baseBranch: session.data.baseBranch,
              repository: repository?.slug,
              provider: repository?.provider,
            }
          : undefined
      }
      changes={changesState}
      changeRequest={changeRequest}
      onOpen={() => {
        if (changesState.state === 'unread') {
          setWokeSandbox(true);
          return;
        }
        setChangesScope('branch');
        show(noChanges ? { type: 'files' } : { type: 'changes' });
      }}
      autoFocus={view.type === 'overview' && view.returned}
      action={
        canRecreateSandbox && sessionId ? (
          <RecreateSandboxAction
            target={{ sessionId, factoryId: factoryProjectId, workspacePath }}
            changes={changes.data}
            changesLoading={changes.isLoading}
            changesError={changes.error ?? undefined}
          />
        ) : undefined
      }
    />
  );

  return (
    <PanelFrame subject={page ? page.subject(back) : <PanelSubject lead={back} />}>
      {view.type === 'overview' ? (
        <div className={overviewClass}>{page ? page.overview(workspace) : workspace()}</div>
      ) : null}
      {view.type === 'changes' || view.type === 'files' ? (
        <Tabs
          defaultTab={view.type}
          value={view.type}
          onValueChange={tab => show({ type: tab })}
          className={viewPanelClass}
        >
          <div className="shrink-0 px-1.5 pb-1.5">
            <TabList variant="pill" size="sm">
              <Tab value="changes">Changes</Tab>
              <Tab value="files">Files</Tab>
            </TabList>
          </div>
          <TabContent value="changes" flush className={viewPanelClass}>
            <WorkspaceChangesPanel
              workspacePath={workspacePath}
              visible={visible}
              scope={changesScope}
              onScopeChange={setChangesScope}
              repositoryProviders={repositoryProviders}
            />
          </TabContent>
          <TabContent value="files" flush className={viewPanelClass}>
            <WorkspaceFileBrowser
              workspacePath={workspacePath}
              visible={visible}
              selectedFilePath={view.type === 'files' ? view.selectedPath : undefined}
              onFileSelect={path => show({ type: 'file', path })}
              openFolders={openFolders}
              showHidden={showHidden}
              onShowHiddenChange={setShowHidden}
              onFolderOpenChange={(path, open) => setOpenFolders(previous => ({ ...previous, [path]: open }))}
              query={fileQuery}
              onQueryChange={setFileQuery}
            />
          </TabContent>
        </Tabs>
      ) : null}
      {view.type === 'file' ? (
        <div className={viewPanelClass}>
          <WorkspaceFileViewer
            filePath={view.path}
            file={file.data}
            isLoading={file.isLoading || (file.isFetching && !file.data)}
            isRefreshing={file.isFetching}
            error={file.error ?? undefined}
            onRefresh={() => file.refetch()}
          />
        </div>
      ) : null}
    </PanelFrame>
  );
});
