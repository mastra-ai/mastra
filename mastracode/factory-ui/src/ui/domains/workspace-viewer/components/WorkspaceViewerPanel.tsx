import { Button } from '@mastra/playground-ui/components/Button';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { cn } from '@mastra/playground-ui/utils/cn';
import { memo, useState } from 'react';
import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';

import type { WorkspaceChanges, WorkspaceChangesScope } from '../../../../api/types';
import { useWorkspaceChanges, useWorkspaceFile } from '../../../../hooks/use-fs';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useUserSessionQuery } from '../../../../hooks/useWorkspaces';
import { useSessionRepository } from '../../factory/hooks/useSessionRepository';
import type { WorkspacePanelPage } from '../context/WorkspacePanelContext';
import { overviewScrollClass } from '../layout';
import type { WorkspacePanelSize } from '../layout';
import type { RepositoryProviders } from './changes/tree/change-tree';
import { PanelSubject } from './PanelSubject';
import { RecreateSandboxAction } from './RecreateSandboxAction';
import { WorkspaceChangesPanel } from './WorkspaceChangesPanel';
import { WorkspaceFileBrowser } from './WorkspaceFileBrowser';
import { WorkspaceFileViewer } from './WorkspaceFileViewer';
import { WorkspaceSection } from './WorkspaceSection';
import type { WorkspaceChangesSummary } from './WorkspaceSection';
import { selectWorkspaceFilePreview } from './workspace-file-preview';
import { IconChevronLeft } from '@mastra/playground-ui/icons/central/IconChevronLeft';

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
  if (!changes.data?.available) return { state: 'unread' };
  const { data } = changes;
  return {
    state: 'read',
    stats: { files: data.changes.length, additions: data.additions, deletions: data.deletions },
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
  // Files and changes views wake the sandbox, so the overview may then read changes freely.
  const [visitedSandbox, setVisitedSandbox] = useState(false);
  const changes = useWorkspaceChanges(workspacePath, { enabled: visible && (readsChanges || visitedSandbox) });
  const factory = useFactoryQuery(factoryProjectId);
  const { repository: sessionRepository, provider } = useSessionRepository();
  const repositoryProviders: RepositoryProviders | undefined = factory.data
    ? Object.fromEntries(factory.data.repositories.map(repo => [repo.slug.toLowerCase(), repo.provider]))
    : undefined;
  const file = useWorkspaceFile(workspacePath, selectedFilePath, {
    enabled: visible && view.type === 'file',
    select: selectWorkspaceFilePreview,
  });
  const changesState = changesSummary(changes);
  const noChanges = changesState.state === 'read' && changesState.stats.files === 0;

  const show = (next: WorkspacePanelView) => {
    setView(next);
    if (next.type !== 'overview') setVisitedSandbox(true);
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
      <IconChevronLeft />
    </Button>
  ) : undefined;
  const workspace = (changeRequest?: ReactNode) => (
    <WorkspaceSection
      loading={session.isLoading}
      workspace={
        session.data
          ? {
              branch: session.data.branch,
              baseBranch: session.data.baseBranch,
              repository: sessionRepository?.slug,
              provider,
            }
          : undefined
      }
      changes={changesState}
      changeRequest={changeRequest}
      onOpen={() => show(noChanges ? { type: 'files' } : { type: 'changes' })}
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
    <div className="flex min-h-0 w-full min-w-0 grow flex-col overflow-hidden">
      <div className="flex shrink-0 py-1.5 ps-1.5 pe-[calc(0.375rem+var(--dock-actions-reserve,0px))]">
        {page ? page.subject(back) : <PanelSubject lead={back} />}
      </div>
      {view.type === 'overview' ? (
        <div className={cn(overviewScrollClass, 'divide-border divide-y')}>
          {page ? page.overview(workspace) : workspace()}
        </div>
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
    </div>
  );
});
