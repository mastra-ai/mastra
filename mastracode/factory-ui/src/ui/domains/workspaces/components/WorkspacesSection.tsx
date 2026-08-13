import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../api/keys';
import { useWorkspaceActivity } from '../../../../hooks/useWorkspaceActivity';
import { useWorkspaceAttention } from '../../../../hooks/useWorkspaceAttention';
import { useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { useWorkspacePullRequestMerges } from '../../../../hooks/useWorkspacePullRequestMerges';
import { useDeleteWorkspaceMutation, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { useChatSessionContext } from '../../chat/context/useChatSessionContext';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { githubNumberForItem } from '../../factory/boardItems';
import { relatedWorkItems, relationshipLabel } from '../../factory/services/relationships';
import { usePinnedSessions } from '../hooks/usePinnedSessions';
import type { FactoryUserSession } from '../services/github';
import { getFactorySessionKind } from '../services/sessionPresentation';
import { SessionNavRow } from './SessionNavRow';
import type { SessionPreviewDetails } from './SessionPreviewCard';

function workspaceStatus(row: FactoryWorkspaceRow): 'running' | 'attention' | undefined {
  if (row.running) return 'running';
  if (row.attention) return 'attention';
  return undefined;
}

export function WorkspacesSection() {
  const { factoryId, sessionId } = useParams<{ factoryId: string; sessionId: string }>();
  const { baseUrl, resourceId, sessionEnabled, factorySessionState } = useChatSessionContext();
  const projectRepositoryId = factorySessionState?.projectRepositoryId;
  const workspaces = useWorkspacesQuery(projectRepositoryId);
  const navigate = useNavigate();
  const location = useLocation();
  const scope = { agentControllerId: AGENT_CONTROLLER_ID, resourceId };
  const deleteWorkspace = useDeleteWorkspaceMutation(factoryId, projectRepositoryId, scope);
  const [confirmDelete, setConfirmDelete] = useState<FactoryUserSession | null>(null);
  const { pinnedSessions, setPinned } = usePinnedSessions();
  const workItems = useWorkItemsQuery(factoryId);
  const workspaceRows = workspaces.data?.workspaces ?? [];
  const workspaceIds = workspaceRows.map(workspace => workspace.sessionId);
  const activityOptions = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    workspaceIds,
    baseUrl,
    enabled: sessionEnabled && Boolean(sessionId),
  };
  const runningByPath = useWorkspaceActivity(activityOptions);
  const queryClient = useQueryClient();
  // The server re-derives session titles at the end of a run.
  const { attentionByPath, clearAttention } = useWorkspaceAttention(
    runningByPath,
    () => void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(projectRepositoryId) }),
  );

  const allWorkItems = workItems.data ?? [];
  const workItemByPath = new Map(
    allWorkItems.flatMap(item =>
      Object.values(item.sessions ?? {}).map(
        sessionRef => [sessionRef.sessionId, { item, threadId: sessionRef.threadId }] as const,
      ),
    ),
  );
  const rows = workspaceRows.flatMap(workspace => {
    const workItemSession = workItemByPath.get(workspace.sessionId);
    const item = workItemSession?.item;
    const pullRequest =
      item?.source === 'github-pr'
        ? item
        : item
          ? [...relatedWorkItems(item, allWorkItems).filter(candidate => candidate.source === 'github-pr')].sort(
              (a, b) => b.updatedAt.localeCompare(a.updatedAt),
            )[0]
          : undefined;
    const pullRequestNumber = pullRequest ? githubNumberForItem(pullRequest) : undefined;
    const active = workspace.sessionId === sessionId;
    const running = runningByPath[workspace.sessionId] === true;
    const factorySession = !workspace.branch.startsWith('user/');
    if (!item && !active && !running && (!factorySession || !workItems.isFetched)) return [];
    return [
      {
        workspace,
        url: `/factories/${factoryId}/workspaces/${workspace.sessionId}`,
        label: workspace.title,
        active,
        running,
        attention: attentionByPath[workspace.sessionId] === true,
        review: getFactorySessionKind(workspace, item) === 'review',
        itemLabel: item && item.source !== 'manual' ? relationshipLabel(item) : undefined,
        itemTitle: item?.title,
        updatedAt: item?.updatedAt ?? workspace.updatedAt,
        threadId: workItemSession?.threadId,
        pullRequestNumber,
        knownMerged: pullRequest?.metadata.merged === true,
        pinned: pinnedSessions.has(workspace.sessionId),
      },
    ];
  });
  const latestRows = (review: boolean) => {
    const sorted = [...rows.filter(row => row.review === review)].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt),
    );
    const visible = sorted.slice(0, 5);
    for (const pinned of sorted.slice(5).filter(row => row.active || row.running || row.attention)) {
      let replaceIndex = visible.length - 1;
      while (
        replaceIndex >= 0 &&
        (visible[replaceIndex]?.active || visible[replaceIndex]?.running || visible[replaceIndex]?.attention)
      ) {
        replaceIndex -= 1;
      }
      if (replaceIndex >= 0) visible[replaceIndex] = pinned;
    }
    return {
      visible: visible.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)),
      all: sorted,
    };
  };
  const workRows = latestRows(false);
  const reviewRows = latestRows(true);
  const pullRequestTargets = [...workRows.visible, ...reviewRows.visible].flatMap(row =>
    row.threadId && row.pullRequestNumber !== undefined
      ? [
          {
            sessionId: row.workspace.sessionId,
            threadId: row.threadId,
            projectPath: row.workspace.sessionId,
            pullRequestNumber: row.pullRequestNumber,
            knownMerged: row.knownMerged,
          },
        ]
      : [],
  );
  const mergedByPath = useWorkspacePullRequestMerges({
    baseUrl,
    resourceId,
    targets: pullRequestTargets,
    enabled: sessionEnabled && Boolean(sessionId) && Boolean(resourceId),
  });
  const pending = deleteWorkspace.isPending;

  const openWorkspaceThread = (workspace: FactoryUserSession) => {
    clearAttention(workspace.sessionId);
    // A workspace's thread id is its own session id (FactoryStartCoordinator
    // seeds the session with threadId = sessionId), so navigate straight there
    // instead of blocking on a session create + thread listing round-trip. The
    // thread page brings the session online on mount and shows a skeleton while
    // its messages load.
    void navigate(`/factories/${factoryId}/workspaces/${workspace.sessionId}/threads/${workspace.sessionId}`, {
      state: { from: location },
    });
  };

  const confirmDeleteWorkspace = () => {
    if (!confirmDelete) return;
    deleteWorkspace.mutate(confirmDelete, { onSuccess: () => setConfirmDelete(null) });
  };

  if (workRows.all.length === 0 && reviewRows.all.length === 0) return null;

  return (
    <section className="flex flex-col gap-4" aria-label="Factory sessions">
      {workRows.all.length > 0 && (
        <WorkspaceGroup
          key="work"
          title="Work Sessions"
          rows={workRows.visible}
          allRows={workRows.all}
          kind="Work session"
          pending={pending}
          mergedByPath={mergedByPath}
          onSelect={openWorkspaceThread}
          onPinChange={setPinned}
          onDelete={setConfirmDelete}
        />
      )}
      {reviewRows.all.length > 0 && (
        <WorkspaceGroup
          key="review"
          title="Review Sessions"
          rows={reviewRows.visible}
          allRows={reviewRows.all}
          kind="Review session"
          pending={pending}
          mergedByPath={mergedByPath}
          onSelect={openWorkspaceThread}
          onPinChange={setPinned}
          onDelete={setConfirmDelete}
        />
      )}

      {confirmDelete && (
        <Dialog open onOpenChange={open => !open && setConfirmDelete(null)}>
          <DialogContent className="w-full max-w-sm" aria-label="Delete workspace">
            <DialogHeader className="px-5 pt-4 pb-2">
              <DialogTitle>Delete workspace?</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 px-5 pb-4">
              <Txt as="p" variant="ui-sm" className="text-icon4 m-0">
                This deletes the <span className="text-icon6">{confirmDelete.branch}</span> checkout and its uncommitted
                changes. This can’t be undone. Threads from this workspace are kept.
              </Txt>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setConfirmDelete(null)} disabled={deleteWorkspace.isPending}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="bg-red-600 text-white hover:bg-red-500"
                  onClick={confirmDeleteWorkspace}
                  disabled={deleteWorkspace.isPending}
                >
                  {deleteWorkspace.isPending ? 'Deleting…' : 'Delete'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}

interface FactoryWorkspaceRow {
  workspace: FactoryUserSession;
  url: string;
  label?: string;
  active: boolean;
  running: boolean;
  attention: boolean;
  review: boolean;
  itemLabel?: string;
  itemTitle?: string;
  updatedAt: string;
  threadId?: string;
  pullRequestNumber?: number;
  knownMerged: boolean;
  pinned: boolean;
}

function WorkspaceGroup({
  title,
  rows,
  allRows,
  kind,
  pending,
  mergedByPath,
  onSelect,
  onPinChange,
  onDelete,
}: {
  title: 'Work Sessions' | 'Review Sessions';
  rows: FactoryWorkspaceRow[];
  allRows: FactoryWorkspaceRow[];
  kind: SessionPreviewDetails['kind'];
  pending: boolean;
  mergedByPath: Record<string, boolean>;
  onSelect: (workspace: FactoryUserSession) => void;
  onPinChange: (sessionId: string, pinned: boolean) => void;
  onDelete: (workspace: FactoryUserSession) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleRows = expanded ? allRows : rows;
  const hiddenCount = allRows.length - rows.length;
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <div className="flex items-center px-1">
        <Txt as="span" variant="ui-xs" className="text-icon3 tracking-wide uppercase">
          {title}
        </Txt>
      </div>
      <MainSidebar.NavList>
        {visibleRows.map(row => (
          <SessionNavRow
            key={row.workspace.sessionId}
            name={
              row.label ??
              (row.workspace.branch.startsWith('slack/') ? row.itemTitle : undefined) ??
              row.workspace.branch
            }
            url={row.url}
            active={row.active}
            disabled={pending}
            merged={mergedByPath[row.workspace.sessionId] === true}
            status={workspaceStatus(row)}
            pinned={row.pinned}
            preview={{
              kind,
              itemLabel: row.itemLabel,
              itemTitle: row.itemTitle,
              branch: row.workspace.branch,
              baseBranch: row.workspace.baseBranch,
              updatedAt: row.updatedAt,
            }}
            onSelect={() => onSelect(row.workspace)}
            onPinChange={pinned => onPinChange(row.workspace.sessionId, pinned)}
            onDelete={() => onDelete(row.workspace)}
          />
        ))}
      </MainSidebar.NavList>
      {hiddenCount > 0 && (
        <button
          type="button"
          className="text-icon3 hover:text-icon5 px-1 text-left text-xs"
          onClick={() => setExpanded(value => !value)}
        >
          {expanded ? 'Show less' : `Show ${hiddenCount} more`}
        </button>
      )}
    </section>
  );
}
