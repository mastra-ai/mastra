import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useQueryClient } from '@tanstack/react-query';
import { GitBranch, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useApiConfig } from '../../../../../shared/api/config';
import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../../../../../shared/api/keys';
import { AGENT_CONTROLLER_THREAD_PAGE_SIZE } from '../../../../../shared/hooks/useAgentControllerThreads';
import { useFactoryBasePath } from '../../../../../shared/hooks/useFactoryBasePath';
import {
  conversationThread,
  useWorkspaceActivity,
  useWorkspaceThreadTitles,
} from '../../../../../shared/hooks/useWorkspaceActivity';
import { useWorkspaceAttention } from '../../../../../shared/hooks/useWorkspaceAttention';
import { useWorkItemsQuery } from '../../../../../shared/hooks/useWorkItems';
import {
  deriveProjectPath,
  useDeleteWorkspaceMutation,
  useSelectWorkspaceMutation,
  useWorkspacesQuery,
} from '../../../../../shared/hooks/useWorkspaces';
import { createAgentControllerClient, requireAgentControllerSession } from '../../chat/services/agentControllerClient';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { useActiveFactoryContext } from '../context/ActiveFactoryProvider';
import { isServerFactory, selectedRepository } from '../services/factories';
import type { Worktree } from '../services/factories';

/**
 * Factory sessions: a GitHub project's feature worktrees, rendered as separate
 * Work Sessions and Review Sessions sections. Each worktree holds a single
 * factory-run conversation, so selecting one opens its thread directly —
 * there is no nested thread list. Sessions are created by board runs, not
 * ad hoc, so there is no create affordance here.
 */
export function WorkspacesSection() {
  const { baseUrl } = useApiConfig();
  const { activeFactory, resourceId, sessionEnabled } = useActiveFactoryContext();
  const workspaces = useWorkspacesQuery(activeFactory);
  const projectPath = deriveProjectPath(activeFactory);
  const scope = { agentControllerId: AGENT_CONTROLLER_ID, resourceId };
  const selectWorkspace = useSelectWorkspaceMutation(activeFactory, scope);
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = useFactoryBasePath();
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath || undefined,
    baseUrl,
    enabled: sessionEnabled,
  });
  const deleteWorkspace = useDeleteWorkspaceMutation(activeFactory, session, scope);
  const [confirmDelete, setConfirmDelete] = useState<Worktree | null>(null);
  const workItems = useWorkItemsQuery(
    activeFactory && isServerFactory(activeFactory) ? activeFactory.binding.factoryProjectId : undefined,
  );
  const worktrees = workspaces.data?.worktrees ?? [];
  const activityOptions = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath || undefined,
    worktreePaths: worktrees.map(worktree => worktree.worktreePath),
    baseUrl,
    enabled: sessionEnabled && Boolean(activeFactory && isServerFactory(activeFactory)),
  };
  const runningByPath = useWorkspaceActivity(activityOptions);
  // Both hooks read the same cached thread listing — one poll, no extra request.
  const titleByPath = useWorkspaceThreadTitles(activityOptions);
  const { attentionByPath, clearAttention } = useWorkspaceAttention(runningByPath);

  if (!activeFactory || !isServerFactory(activeFactory)) return null;

  const selectedPath = workspaces.data?.selected?.worktreePath;
  const pending = selectWorkspace.isPending || deleteWorkspace.isPending;
  const rootWorktreePaths = new Set(
    activeFactory.binding.repositories.flatMap(repository =>
      repository.sandboxWorkdir ? [repository.sandboxWorkdir] : [],
    ),
  );
  const allWorkItems = workItems.data ?? [];
  const workItemByPath = new Map(
    allWorkItems.flatMap(item =>
      Object.values(item.sessions ?? {}).map(sessionRef => [sessionRef.sessionId, item] as const),
    ),
  );
  const rows = worktrees.flatMap(worktree => {
    const item = workItemByPath.get(worktree.worktreePath);
    const active = worktree.worktreePath === selectedPath;
    const running = runningByPath[worktree.worktreePath] === true;
    const factorySession = !rootWorktreePaths.has(worktree.worktreePath) && !worktree.branch.startsWith('user/');
    if (!item && !active && !running && (!factorySession || !workItems.isFetched)) return [];
    return [
      {
        worktree,
        label: titleByPath[worktree.worktreePath],
        active,
        running,
        attention: attentionByPath[worktree.worktreePath] === true,
        review: item?.source === 'github-pr' || (!item && worktree.branch.startsWith('factory/pr-')),
        updatedAt: item?.updatedAt ?? '',
      },
    ];
  });
  const latestRows = (review: boolean) => {
    const sorted = [...rows.filter(row => row.review === review)].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
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
    return visible.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  };
  const workRows = latestRows(false);
  const reviewRows = latestRows(true);

  // Threads are scoped to a worktree, so entering a session lands on its
  // conversation thread (creating one when it has none) — from anywhere,
  // including Factory pages: a session row IS its conversation.
  const openWorktreeThread = async (worktreePath: string) => {
    try {
      // Address the target worktree's own session (sessions are scoped per
      // worktree). Create it up front so a brand-new scope is seeded with its
      // projectPath tag before any thread is created in it.
      const { session: targetSession } = createAgentControllerClient({
        agentControllerId: AGENT_CONTROLLER_ID,
        resourceId,
        scope: worktreePath,
        baseUrl,
        enabled: sessionEnabled,
      });
      const chatSession = requireAgentControllerSession(targetSession);
      await chatSession.create({ tags: { projectPath: worktreePath } });
      const threadsKey = queryKeys.agentControllerThreads(AGENT_CONTROLLER_ID, resourceId, worktreePath);
      const threads = await queryClient.fetchQuery({
        queryKey: threadsKey,
        queryFn: () =>
          chatSession.listThreads({
            limit: AGENT_CONTROLLER_THREAD_PAGE_SIZE,
            tags: { projectPath: worktreePath },
          }),
      });
      // Same selection rule as the row label (latest titled thread first), so
      // the row can never open a different thread than the one it is named
      // after — e.g. a newer empty untitled thread seeded by session creation.
      const latest = conversationThread(threads);
      if (latest) {
        // Warm the message cache first so the thread page renders content
        // instead of a loading skeleton, then jump straight to the target
        // thread: once the route points at a thread that exists in the new
        // scope, the route-thread sync settles on it instead of erroring on
        // the stale one.
        await queryClient.prefetchQuery({
          queryKey: queryKeys.agentControllerThreadMessages(
            AGENT_CONTROLLER_ID,
            resourceId,
            latest.id,
            INITIAL_THREAD_MESSAGE_LIMIT,
          ),
          queryFn: () => chatSession.listMessages(latest.id, INITIAL_THREAD_MESSAGE_LIMIT),
        });
        void navigate(basePath.thread(latest.id), { replace: true });
        return;
      }
      // Empty worktree: leave the stale thread route before creating, so the
      // route-thread sync can't race the create call and error on the old
      // thread. The scoped session is pinned to this worktree, so the new
      // thread is tagged with its projectPath.
      if (location.pathname.startsWith(`${basePath.base}/threads/`))
        void navigate(basePath.newThread(), { replace: true });
      const created = await chatSession.createThread();
      // A fresh thread has no messages; seed the cache to skip the skeleton.
      queryClient.setQueryData(
        queryKeys.agentControllerThreadMessages(
          AGENT_CONTROLLER_ID,
          resourceId,
          created.id,
          INITIAL_THREAD_MESSAGE_LIMIT,
        ),
        [],
      );
      void queryClient.invalidateQueries({ queryKey: threadsKey });
      void navigate(basePath.thread(created.id), { replace: true });
    } catch {
      void navigate(basePath.newThread(), { replace: true });
    }
  };

  const confirmDeleteWorktree = () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    deleteWorkspace.mutate(target, {
      onSuccess: ({ updated, wasSelected }) => {
        setConfirmDelete(null);
        // Threads under the deleted worktree are gone; if we were inside one,
        // land on the fallback workspace's latest thread. Factory pages are
        // worktree-independent, so deleting from there stays put.
        const onFactoryPage = /\/(overview|work|review|metrics|audit)$/.test(location.pathname);
        if (wasSelected && !onFactoryPage) {
          const fallback = selectedRepository(updated)?.selectedWorktreePath;
          if (fallback) void openWorktreeThread(fallback);
          else void navigate(basePath.newThread(), { replace: true });
        }
      },
      onError: () => setConfirmDelete(null),
    });
  };

  if (workRows.length === 0 && reviewRows.length === 0) return null;

  return (
    <section className="flex flex-col gap-4" aria-label="Factory sessions">
      {workRows.length > 0 && (
        <WorkspaceGroup
          title="Work Sessions"
          rows={workRows}
          pending={pending}
          onSelect={row => {
            clearAttention(row.worktree.worktreePath);
            if (row.active) {
              void openWorktreeThread(row.worktree.worktreePath);
              return;
            }
            selectWorkspace.mutate(row.worktree.worktreePath, {
              onSuccess: () => void openWorktreeThread(row.worktree.worktreePath),
            });
          }}
          onDelete={worktree => setConfirmDelete(worktree)}
        />
      )}
      {reviewRows.length > 0 && (
        <WorkspaceGroup
          title="Review Sessions"
          rows={reviewRows}
          pending={pending}
          onSelect={row => {
            clearAttention(row.worktree.worktreePath);
            if (row.active) {
              void openWorktreeThread(row.worktree.worktreePath);
              return;
            }
            selectWorkspace.mutate(row.worktree.worktreePath, {
              onSuccess: () => void openWorktreeThread(row.worktree.worktreePath),
            });
          }}
          onDelete={worktree => setConfirmDelete(worktree)}
        />
      )}

      {confirmDelete && (
        <Dialog open onOpenChange={open => !open && setConfirmDelete(null)}>
          <DialogContent className="w-full max-w-sm" aria-label="Delete workspace">
            <DialogHeader className="px-5 pt-4 pb-2">
              <DialogTitle>Delete workspace?</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 px-5 pb-4">
              <Txt as="p" variant="ui-sm" className="m-0 text-icon4">
                This deletes the <span className="text-icon6">{confirmDelete.branch}</span> checkout, its uncommitted
                changes, and every thread in this workspace. This can’t be undone.
              </Txt>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setConfirmDelete(null)} disabled={deleteWorkspace.isPending}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="bg-red-600 text-white hover:bg-red-500"
                  onClick={confirmDeleteWorktree}
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
  worktree: Worktree;
  label?: string;
  active: boolean;
  running: boolean;
  attention: boolean;
  review: boolean;
  updatedAt: string;
}

function WorkspaceGroup({
  title,
  rows,
  pending,
  onSelect,
  onDelete,
}: {
  title: 'Work Sessions' | 'Review Sessions';
  rows: FactoryWorkspaceRow[];
  pending: boolean;
  onSelect: (row: FactoryWorkspaceRow) => void;
  onDelete: (worktree: Worktree) => void;
}) {
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <div className="flex items-center px-1">
        <Txt as="span" variant="ui-xs" className="text-icon3 uppercase tracking-wide">
          {title}
        </Txt>
      </div>
      <div className="flex flex-col gap-1">
        {rows.map(row => (
          <WorkspaceRow
            key={row.worktree.worktreePath}
            worktree={row.worktree}
            label={row.label}
            active={row.active}
            running={row.running}
            attention={row.attention}
            disabled={pending}
            onSelect={() => onSelect(row)}
            onDelete={() => onDelete(row.worktree)}
          />
        ))}
      </div>
    </section>
  );
}

export function WorkspaceRow({
  worktree,
  label,
  active,
  running,
  attention,
  disabled,
  onSelect,
  onDelete,
}: {
  worktree: Worktree;
  /** Display name (e.g. the session's thread title); defaults to the worktree's branch. */
  label?: string;
  active: boolean;
  running: boolean;
  /** A run finished here and the user hasn't opened the workspace since. */
  attention: boolean;
  disabled: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  const name = label ?? worktree.branch;
  return (
    <div className={`group relative rounded-md ${active ? 'bg-surface4' : 'hover:bg-surface3'}`}>
      <button
        type="button"
        aria-current={active ? 'true' : undefined}
        aria-label={name}
        disabled={disabled}
        onClick={onSelect}
        title={worktree.branch}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition ${active ? 'text-icon6' : 'text-icon3 hover:text-icon5'} disabled:cursor-default disabled:opacity-70`}
      >
        <GitBranch size={13} />
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {running ? (
          <span
            role="status"
            aria-label={`Agent working in ${name}`}
            title="Agent working"
            className="ml-auto size-2 shrink-0 animate-pulse rounded-full bg-accent1 group-hover:opacity-0"
          />
        ) : attention ? (
          <span
            role="status"
            aria-label={`Agent finished in ${name}`}
            title="Agent finished — open to dismiss"
            className="ml-auto size-2 shrink-0 rounded-full bg-accent1 group-hover:opacity-0"
          />
        ) : null}
      </button>
      {onDelete && (
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Workspace actions"
                disabled={disabled}
                className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 data-[popup-open]:opacity-100"
              >
                <MoreHorizontal size={15} />
              </Button>
            }
          />
          <DropdownMenu.Content align="end" className="min-w-28">
            <DropdownMenu.Item variant="destructive" onClick={onDelete}>
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      )}
    </div>
  );
}
