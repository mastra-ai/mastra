import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GitBranch, Plus } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, KeyboardEvent, ReactNode } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { useSetAgentControllerStateMutation } from '../../chat/hooks/useAgentControllerStateMutations';
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

  if (activeProject?.source !== 'github') return null;

  const worktrees = workspaces.data?.worktrees ?? [];
  const selectedPath = workspaces.data?.selected?.worktreePath;
  const pending = createWorkspace.isPending || selectWorkspace.isPending;

  const resetCreate = () => {
    setCreating(false);
    setBranch('');
  };

  const createBranch = () => {
    const trimmed = branch.trim();
    if (!trimmed) return;
    createWorkspace.mutate(trimmed, { onSuccess: resetCreate });
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

  const hasNestedActive = Boolean(children) && worktrees.some(worktree => worktree.worktreePath === selectedPath);

  return (
    <section className={`flex flex-col gap-2 ${children ? 'min-h-0 flex-1' : ''}`} aria-label="Workspaces">
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

      <div className={`flex flex-col gap-1 ${children ? 'min-h-0 flex-1' : ''}`}>
        {worktrees.map(worktree => {
          const active = worktree.worktreePath === selectedPath;
          const nested = active && Boolean(children);
          return (
            <div key={worktree.worktreePath} className={`flex flex-col gap-1 ${nested ? 'min-h-0 flex-1' : ''}`}>
              <WorkspaceRow
                worktree={worktree}
                active={active}
                disabled={pending}
                onSelect={() => selectWorkspace.mutate(worktree.worktreePath)}
              />
              {nested && (
                <div className="ml-[15px] flex min-h-0 flex-1 flex-col border-l border-border1 pl-2">{children}</div>
              )}
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

        {Boolean(children) && !hasNestedActive && <div className="flex min-h-0 flex-1 flex-col">{children}</div>}
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
