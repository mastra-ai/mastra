import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useQueryClient } from '@tanstack/react-query';
import { GitBranch, MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useApiConfig } from '../../../../../shared/api/config';
import { queryKeys } from '../../../../../shared/api/keys';
import { AGENT_CONTROLLER_THREAD_PAGE_SIZE } from '../../chat/hooks/useAgentControllerThreads';
import { createAgentControllerClient, requireAgentControllerSession } from '../../chat/services/agentControllerClient';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { useActiveProjectContext } from '../context/ActiveProjectProvider';
import {
  deriveProjectPath,
  useCreateWorkspaceMutation,
  useDeleteWorkspaceMutation,
  useSelectWorkspaceMutation,
  useWorkspacesQuery,
} from '../hooks/useWorkspaces';
import { useWorkspaceActivity } from '../hooks/useWorkspaceActivity';
import type { Worktree } from '../services/projects';

/**
 * Sidebar section listing a GitHub project's worktrees.
 *
 * Threads are scoped to the worktree they run in, so callers can pass the
 * thread list as `children`; it renders nested under the active worktree row
 * (or after the list when no worktree is selected yet). Feature worktrees
 * hold a single conversation, so the thread list renders read-only for them
 * (title only — no rename/clone/delete or new-thread controls).
 */
export function WorkspacesSection({ children }: { children?: ReactNode }) {
  const { baseUrl } = useApiConfig();
  const { activeProject, resourceId, sessionEnabled } = useActiveProjectContext();
  const [creating, setCreating] = useState(false);
  const [branch, setBranch] = useState('');
  const workspaces = useWorkspacesQuery(activeProject);
  const projectPath = deriveProjectPath(activeProject);
  const scope = { agentControllerId: AGENT_CONTROLLER_ID, resourceId };
  const selectWorkspace = useSelectWorkspaceMutation(activeProject, scope);
  const createWorkspace = useCreateWorkspaceMutation(activeProject, scope);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath || undefined,
    baseUrl,
    enabled: sessionEnabled,
  });
  const deleteWorkspace = useDeleteWorkspaceMutation(activeProject, session, scope);
  const [confirmDelete, setConfirmDelete] = useState<Worktree | null>(null);
  const worktrees = workspaces.data?.worktrees ?? [];
  const runningByPath = useWorkspaceActivity({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    worktreePaths: worktrees.map(worktree => worktree.worktreePath),
    baseUrl,
    enabled: sessionEnabled && activeProject?.source === 'github',
  });

  if (activeProject?.source !== 'github') return null;

  const selectedPath = workspaces.data?.selected?.worktreePath;
  const pending = createWorkspace.isPending || selectWorkspace.isPending || deleteWorkspace.isPending;

  // Threads are scoped to a worktree, so entering a workspace lands on its
  // most recent thread (creating one when it has none). Factory pages are
  // worktree-independent and stay put.
  const openWorktreeThread = async (worktreePath: string) => {
    if (location.pathname.startsWith('/factory')) return;
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
      const latest = [...threads].sort((a, b) => {
        const ta = a.updatedAt ?? a.createdAt ?? '';
        const tb = b.updatedAt ?? b.createdAt ?? '';
        return tb.localeCompare(ta);
      })[0];
      if (latest) {
        // Warm the message cache first so the thread page renders content
        // instead of a loading skeleton, then jump straight to the target
        // thread: once the route points at a thread that exists in the new
        // scope, the route-thread sync settles on it instead of erroring on
        // the stale one.
        await queryClient.prefetchQuery({
          queryKey: queryKeys.agentControllerThreadMessages(AGENT_CONTROLLER_ID, resourceId, latest.id),
          queryFn: () => chatSession.listMessages(latest.id),
        });
        void navigate(`/threads/${latest.id}`, { replace: true });
        return;
      }
      // Empty worktree: leave the stale thread route before creating, so the
      // route-thread sync can't race the create call and error on the old
      // thread. The scoped session is pinned to this worktree, so the new
      // thread is tagged with its projectPath.
      if (location.pathname.startsWith('/threads/')) void navigate('/new', { replace: true });
      const created = await chatSession.createThread();
      // A fresh thread has no messages; seed the cache to skip the skeleton.
      queryClient.setQueryData(
        queryKeys.agentControllerThreadMessages(AGENT_CONTROLLER_ID, resourceId, created.id),
        [],
      );
      void queryClient.invalidateQueries({ queryKey: threadsKey });
      void navigate(`/threads/${created.id}`, { replace: true });
    } catch {
      void navigate('/new', { replace: true });
    }
  };

  const resetCreate = () => {
    setCreating(false);
    setBranch('');
  };

  const confirmDeleteWorktree = () => {
    if (!confirmDelete) return;
    const target = confirmDelete;
    deleteWorkspace.mutate(target, {
      onSuccess: ({ updated, wasSelected }) => {
        setConfirmDelete(null);
        // Threads under the deleted worktree are gone; if we were inside one,
        // land on the fallback workspace's latest thread.
        if (wasSelected) {
          const fallback = updated.selectedWorktreePath;
          if (fallback) void openWorktreeThread(fallback);
          else void navigate('/new', { replace: true });
        }
      },
      onError: () => setConfirmDelete(null),
    });
  };

  const createBranch = () => {
    const trimmed = branch.trim();
    if (!trimmed) return;
    createWorkspace.mutate(trimmed, {
      onSuccess: updated => {
        resetCreate();
        const path = updated.selectedWorktreePath;
        if (path) void openWorktreeThread(path);
      },
    });
  };

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createBranch();
  };

  const onCreateKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') resetCreate();
    if (event.key === 'Enter') {
      event.preventDefault();
      createBranch();
    }
  };

  return (
    <section className="flex flex-col gap-2" aria-label="Workspaces">
      <div className="flex items-center justify-between px-1">
        <Txt as="span" variant="ui-xs" className="text-icon3 uppercase tracking-wide">
          Workspaces
        </Txt>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="New workspace"
          onClick={() => setCreating(true)}
          disabled={creating || pending}
        >
          <Plus size={15} />
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        {worktrees.map(worktree => {
          const active = worktree.worktreePath === selectedPath;
          const nested = active && Boolean(children);
          return (
            <div key={worktree.worktreePath} className="flex flex-col gap-1">
              <WorkspaceRow
                worktree={worktree}
                active={active}
                running={runningByPath[worktree.worktreePath] === true}
                disabled={pending}
                onSelect={() =>
                  selectWorkspace.mutate(worktree.worktreePath, {
                    onSuccess: () => void openWorktreeThread(worktree.worktreePath),
                  })
                }
                onDelete={
                  worktree.worktreePath === activeProject.sandboxWorkdir ? undefined : () => setConfirmDelete(worktree)
                }
              />
              {nested && <div className="ml-[15px] flex flex-col border-l border-border1 pl-2">{children}</div>}
            </div>
          );
        })}

        {creating && (
          <form aria-label="Create workspace" className="flex flex-col gap-1" onSubmit={submitCreate}>
            <Input
              aria-label="Branch name"
              autoFocus
              value={branch}
              onChange={event => setBranch(event.target.value)}
              onKeyDown={onCreateKeyDown}
              placeholder="feature-branch"
              disabled={createWorkspace.isPending}
              className="h-8 text-xs"
            />
            {createWorkspace.error && (
              <Txt as="p" variant="ui-xs" className="m-0 text-red-400">
                {createWorkspace.error instanceof Error ? createWorkspace.error.message : 'Failed to create workspace'}
              </Txt>
            )}
          </form>
        )}

        {Boolean(children) && !worktrees.some(worktree => worktree.worktreePath === selectedPath) && (
          <div className="flex flex-col">{children}</div>
        )}
      </div>

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

function WorkspaceRow({
  worktree,
  active,
  running,
  disabled,
  onSelect,
  onDelete,
}: {
  worktree: Worktree;
  active: boolean;
  running: boolean;
  disabled: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className={`group relative rounded-md ${active ? 'bg-surface4' : 'hover:bg-surface3'}`}>
      <button
        type="button"
        aria-current={active ? 'true' : undefined}
        aria-disabled={active || undefined}
        disabled={disabled}
        onClick={active ? undefined : onSelect}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition ${active ? 'text-icon6' : 'text-icon3 hover:text-icon5'} disabled:cursor-default disabled:opacity-70`}
      >
        <GitBranch size={13} />
        <span className="truncate">{worktree.branch}</span>
        {running && (
          <span
            role="status"
            aria-label={`Agent working in ${worktree.branch}`}
            title="Agent working"
            className="ml-auto size-2 shrink-0 animate-pulse rounded-full bg-accent1 group-hover:opacity-0"
          />
        )}
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
