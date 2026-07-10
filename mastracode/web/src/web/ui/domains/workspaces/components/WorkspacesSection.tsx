import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useQueryClient } from '@tanstack/react-query';
import { GitBranch, Plus } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useApiConfig } from '../../../../../shared/api/config';
import { queryKeys } from '../../../../../shared/api/keys';
import { useSetAgentControllerStateMutation } from '../../chat/hooks/useAgentControllerStateMutations';
import { AGENT_CONTROLLER_THREAD_PAGE_SIZE } from '../../chat/hooks/useAgentControllerThreads';
import { createAgentControllerClient, requireAgentControllerSession } from '../../chat/services/agentControllerClient';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { useActiveProjectContext } from '../context/ActiveProjectProvider';
import { useCreateWorkspaceMutation, useSelectWorkspaceMutation, useWorkspacesQuery } from '../hooks/useWorkspaces';
import type { Worktree } from '../services/projects';

/**
 * Sidebar section listing a GitHub project's worktrees.
 *
 * Threads are scoped to the worktree they run in, so callers can pass the
 * thread list as `children`: it renders nested under the active worktree row
 * (or after the list when no worktree is selected yet).
 */
export function WorkspacesSection({ children }: { children?: ReactNode }) {
  const { baseUrl } = useApiConfig();
  const { activeProject, resourceId, sessionEnabled } = useActiveProjectContext();
  const [creating, setCreating] = useState(false);
  const [branch, setBranch] = useState('');
  const workspaces = useWorkspacesQuery(activeProject);
  const scope = { agentControllerId: AGENT_CONTROLLER_ID, resourceId };
  const setStateMutation = useSetAgentControllerStateMutation({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    baseUrl,
    enabled: sessionEnabled,
  });
  const workspaceSession = { setState: (updates: Record<string, unknown>) => setStateMutation.mutateAsync(updates) };
  const selectWorkspace = useSelectWorkspaceMutation(activeProject, workspaceSession, scope);
  const createWorkspace = useCreateWorkspaceMutation(activeProject, workspaceSession, scope);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { session } = createAgentControllerClient({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    baseUrl,
    enabled: sessionEnabled,
  });

  if (activeProject?.source !== 'github') return null;

  const worktrees = workspaces.data?.worktrees ?? [];
  const selectedPath = workspaces.data?.selected?.worktreePath;
  const pending = createWorkspace.isPending || selectWorkspace.isPending;

  // Threads are scoped to a worktree, so entering a workspace lands on its
  // most recent thread (creating one when it has none). Factory pages are
  // worktree-independent and stay put.
  const openWorktreeThread = async (worktreePath: string) => {
    if (location.pathname.startsWith('/factory')) return;
    try {
      const chatSession = requireAgentControllerSession(session);
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
      // thread. The workspace switch already rebound the session to this
      // worktree, so the new thread is tagged with its projectPath.
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
                disabled={pending}
                onSelect={() =>
                  selectWorkspace.mutate(worktree.worktreePath, {
                    onSuccess: () => void openWorktreeThread(worktree.worktreePath),
                  })
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
    </section>
  );
}

function WorkspaceRow({
  worktree,
  active,
  disabled,
  onSelect,
}: {
  worktree: Worktree;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? 'true' : undefined}
      aria-disabled={active || undefined}
      disabled={disabled}
      onClick={active ? undefined : onSelect}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition ${active ? 'bg-surface4 text-icon6' : 'text-icon3 hover:bg-surface3 hover:text-icon5'} disabled:cursor-default disabled:opacity-70`}
    >
      <GitBranch size={13} />
      <span className="truncate">{worktree.branch}</span>
    </button>
  );
}
