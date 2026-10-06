import { cn } from '@mastra/playground-ui/utils/cn';
import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogAction,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GitPullRequest, SquareKanban } from 'lucide-react';
import { SidebarSectionHeading } from '../../../SidebarSectionHeading';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useActiveRunResources } from '../../../../hooks/useActiveRunResources';
import { useParkedSessions, useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { useWorkspacePullRequestMerges } from '../../../../hooks/useWorkspacePullRequestMerges';
import { useDeleteWorkspaceMutation, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { useChatSessionContext } from '../../chat/context/useChatSessionContext';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { itemAwaitsPerson } from '../../factory/boardCardState';
import { changeRequestNumberForItem, pullRequestStatusForItem } from '../../factory/boardItems';
import { useItemDecisions } from '../../factory/hooks/useBoardDecisions';
import { relatedWorkItemIndex, relationshipLabel } from '../../factory/services/relationships';
import type { ChangeRequestProvider } from '../../factory/services/githubSubscriptions';
import type { WorkItem } from '../../factory/services/workItems';
import { isPullRequestSource } from '../../factory/services/workItems';
import { isTerminalStage } from '../../factory/stages';
import { usePinnedSessions } from '../hooks/usePinnedSessions';
import type { FactoryUserSession } from '../services/user-sessions';
import { getFactorySessionKind, getSessionOwnerDetails } from '../services/sessionPresentation';
import type { SessionViewerProfile } from '../services/sessionPresentation';
import { SessionNavRow } from './SessionNavRow';
import { SessionOwnerToggle } from './SessionOwnerToggle';
import { sessionRowStatus } from '../services/sessionStatus';
import type { SessionPreviewDetails } from './SessionPreviewCard';

const COLLAPSED_ROW_COUNT = 5;

/** Nothing left to watch: the card is done or canceled, or its pull request is merged or closed. */
function isSettled(item: WorkItem | undefined, pullRequest: WorkItem | undefined): boolean {
  if (item?.stages.some(isTerminalStage)) return true;
  if (!pullRequest) return false;
  const status = pullRequestStatusForItem(pullRequest);
  return status === 'merged' || status === 'closed';
}

/** Waiting on a person or moving, then open, then finished — a card the agent is still in is never finished. */
function watchRank(row: FactoryWorkspaceRow): number {
  if (row.initializing || row.running || row.attention) return 0;
  return row.settled ? 2 : 1;
}

/**
 * Explicit intent first, then whatever still has work in it, newest first inside a tier.
 * Sorting on creation rather than activity is what keeps a row still: every card write bumps
 * `updatedAt` and the board polls, so an activity order reshuffles the sidebar under the reader.
 * Opening a session is that same reshuffle with the reader's own click behind it, so the row
 * being read holds its place and is kept reachable by `latestRows` instead.
 * Session id closes it into a total order — the sessions endpoint sorts nothing, so anything
 * falling through to its order would still shuffle.
 */
const bySessionPriority = (a: FactoryWorkspaceRow, b: FactoryWorkspaceRow) =>
  Number(b.pinned) - Number(a.pinned) ||
  watchRank(a) - watchRank(b) ||
  b.createdAt.localeCompare(a.createdAt) ||
  b.workspace.sessionId.localeCompare(a.workspace.sessionId);

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
  const [ownerScope, setOwnerScope] = useState({ work: true, review: true });
  const auth = useFactoryAuth();
  const viewerUserId = auth.data?.user?.userId;
  const { pinnedSessions, setPinned } = usePinnedSessions();
  const workItems = useWorkItemsQuery(factoryId);
  const parkedSessions = useParkedSessions(factoryId);
  const workspaceRows = workspaces.data?.workspaces ?? [];
  const workspaceIds = workspaceRows.map(workspace => workspace.sessionId);
  const runningByPath = useActiveRunResources({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceIds: workspaceIds,
  });
  const { proposalByItem, effectByItem } = useItemDecisions(factoryId);

  const allWorkItems = workItems.data ?? [];
  const workItemByPath = new Map(
    allWorkItems.flatMap(item =>
      Object.values(item.sessions ?? {}).map(
        sessionRef => [sessionRef.sessionId, { item, threadId: sessionRef.threadId }] as const,
      ),
    ),
  );
  const relatedItemsFor = relatedWorkItemIndex(allWorkItems);
  const latestPullRequestFor = (item: WorkItem) => {
    if (isPullRequestSource(item.source)) return item;
    return relatedItemsFor(item)
      .filter(related => isPullRequestSource(related.source))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  };

  const rows = workspaceRows.flatMap(workspace => {
    const workItemSession = workItemByPath.get(workspace.sessionId);
    const item = workItemSession?.item;
    const pullRequest = item && latestPullRequestFor(item);
    const pullRequestNumber = pullRequest ? changeRequestNumberForItem(pullRequest) : undefined;
    const provider = pullRequest?.source === 'gitlab-pr' ? ('gitlab' as const) : ('github' as const);
    const active = workspace.sessionId === sessionId;
    const running = runningByPath[workspace.sessionId] === true;
    const initializing = !workspace.materializedAt;
    const factorySession = !workspace.branch.startsWith('user/');
    if (!item && !active && !running && (!factorySession || !workItems.isFetched)) return [];
    return [
      {
        workspace,
        url: `/factories/${factoryId}/workspaces/${workspace.sessionId}`,
        label: workspace.title,
        active,
        initializing,
        running,
        attention:
          parkedSessions.has(workspace.sessionId) ||
          (item !== undefined && itemAwaitsPerson(proposalByItem.get(item.id), effectByItem.get(item.id))),
        review: getFactorySessionKind(workspace, item) === 'review',
        itemLabel: item && item.source !== 'manual' ? relationshipLabel(item) : undefined,
        itemTitle: item?.title,
        settled: isSettled(item, pullRequest),
        createdAt: workspace.createdAt,
        updatedAt: item?.updatedAt ?? workspace.updatedAt,
        threadId: workItemSession?.threadId,
        pullRequestNumber,
        provider,
        knownMerged: pullRequest?.metadata.merged === true,
        pinned: pinnedSessions.has(workspace.sessionId),
      },
    ];
  });
  const latestRows = (review: boolean) => {
    const mineOnly = ownerScope[review ? 'review' : 'work'];
    const all = rows
      .filter(row => row.review === review)
      .filter(row => !mineOnly || !viewerUserId || row.workspace.userId === viewerUserId)
      .sort(bySessionPriority);
    const visible = all.slice(0, COLLAPSED_ROW_COUNT);
    const open = all.find(row => row.active);
    if (open && !visible.includes(open)) visible.push(open);
    return { visible, all };
  };
  const hasWorkRows = rows.some(row => !row.review);
  const hasReviewRows = rows.some(row => row.review);
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
            provider: row.provider,
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
    void navigate(`/factories/${factoryId}/workspaces/${workspace.sessionId}/threads/${workspace.sessionId}`, {
      state: { from: location },
    });
  };

  const confirmDeleteWorkspace = () => {
    if (!confirmDelete) return;
    deleteWorkspace.mutate(confirmDelete, { onSuccess: () => setConfirmDelete(null) });
  };

  if (!hasWorkRows && !hasReviewRows) return null;

  return (
    <section className="flex flex-col gap-4" aria-label="Factory sessions">
      {hasWorkRows && (
        <WorkspaceGroup
          key="work"
          title="Work Sessions"
          rows={workRows.visible}
          allRows={workRows.all}
          mineOnly={ownerScope.work}
          onMineOnlyChange={mineOnly => setOwnerScope(current => ({ ...current, work: mineOnly }))}
          kind="Work session"
          pending={pending}
          mergedByPath={mergedByPath}
          viewerUserId={viewerUserId}
          viewerProfile={auth.data?.user}
          onSelect={openWorkspaceThread}
          onPinChange={setPinned}
          onDelete={setConfirmDelete}
        />
      )}
      {hasReviewRows && (
        <WorkspaceGroup
          key="review"
          title="Review Sessions"
          rows={reviewRows.visible}
          allRows={reviewRows.all}
          mineOnly={ownerScope.review}
          onMineOnlyChange={mineOnly => setOwnerScope(current => ({ ...current, review: mineOnly }))}
          kind="Review session"
          pending={pending}
          mergedByPath={mergedByPath}
          viewerUserId={viewerUserId}
          viewerProfile={auth.data?.user}
          onSelect={openWorkspaceThread}
          onPinChange={setPinned}
          onDelete={setConfirmDelete}
        />
      )}

      {confirmDelete && (
        <Dialog
          open
          onOpenChange={open => !open && setConfirmDelete(null)}
          intent="destructive"
          pending={deleteWorkspace.isPending}
        >
          <DialogContent size="sm" aria-label="Delete workspace">
            <DialogHeader>
              <DialogTitle>Delete workspace?</DialogTitle>
              <DialogDescription>
                This deletes the <span className="text-foreground">{confirmDelete.branch}</span> checkout and its
                uncommitted changes. This can’t be undone. Threads from this workspace are kept.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogCancel>Cancel</DialogCancel>
              <DialogAction onConfirm={confirmDeleteWorkspace}>
                {deleteWorkspace.isPending ? 'Deleting…' : 'Delete'}
              </DialogAction>
            </DialogFooter>
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
  initializing: boolean;
  running: boolean;
  attention: boolean;
  review: boolean;
  itemLabel?: string;
  itemTitle?: string;
  settled: boolean;
  createdAt: string;
  updatedAt: string;
  threadId?: string;
  pullRequestNumber?: number;
  provider: ChangeRequestProvider;
  knownMerged: boolean;
  pinned: boolean;
}

function WorkspaceGroup({
  title,
  rows,
  allRows,
  mineOnly,
  onMineOnlyChange,
  kind,
  pending,
  mergedByPath,
  viewerUserId,
  viewerProfile,
  onSelect,
  onPinChange,
  onDelete,
}: {
  title: 'Work Sessions' | 'Review Sessions';
  rows: FactoryWorkspaceRow[];
  allRows: FactoryWorkspaceRow[];
  mineOnly: boolean;
  onMineOnlyChange: (mineOnly: boolean) => void;
  kind: SessionPreviewDetails['kind'];
  pending: boolean;
  mergedByPath: Record<string, boolean>;
  viewerUserId: string | undefined;
  viewerProfile: SessionViewerProfile | undefined;
  onSelect: (workspace: FactoryUserSession) => void;
  onPinChange: (sessionId: string, pinned: boolean) => void;
  onDelete: (workspace: FactoryUserSession) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleRows = expanded ? allRows : rows;
  const hiddenCount = allRows.length - rows.length;
  return (
    <section className="flex flex-col gap-1" aria-label={title}>
      <SidebarSectionHeading
        icon={kind === 'Review session' ? <GitPullRequest /> : <SquareKanban />}
        action={
          viewerUserId ? (
            <SessionOwnerToggle label={`${kind.toLowerCase()}s`} mineOnly={mineOnly} onChange={onMineOnlyChange} />
          ) : undefined
        }
      >
        {title}
      </SidebarSectionHeading>
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
            merged={mergedByPath[row.workspace.sessionId] ?? row.knownMerged}
            changeRequestProvider={row.provider}
            status={sessionRowStatus(row)}
            pinned={row.pinned}
            preview={{
              kind,
              owner: getSessionOwnerDetails(row.workspace, viewerProfile),
              itemLabel: row.itemLabel,
              itemTitle: row.itemTitle,
              branch: row.workspace.branch,
              baseBranch: row.workspace.baseBranch,
              updatedAt: row.updatedAt,
            }}
            onSelect={() => onSelect(row.workspace)}
            onPinChange={pinned => onPinChange(row.workspace.sessionId, pinned)}
            onDelete={viewerUserId && row.workspace.userId !== viewerUserId ? undefined : () => onDelete(row.workspace)}
          />
        ))}
      </MainSidebar.NavList>
      {visibleRows.length === 0 ? (
        <Txt as="p" variant="caption" tone="muted" role="status" className="m-0 pl-3">
          No sessions of your own.
        </Txt>
      ) : null}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(value => !value)}
          className={cn('text-muted-foreground', 'hover:text-foreground pl-3 text-left')}
        >
          <Txt as="span" variant="caption" className="block">
            {expanded ? 'Show less' : `Show ${hiddenCount} more`}
          </Txt>
        </button>
      )}
    </section>
  );
}
