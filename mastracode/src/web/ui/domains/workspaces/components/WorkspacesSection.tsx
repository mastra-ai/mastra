import { Button, Input, Txt } from '@mastra/playground-ui';
import { GitBranch, Plus } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';

import { useCreateWorkspaceMutation, useSelectWorkspaceMutation, useWorkspacesQuery } from '../hooks/useWorkspaces';
import type { Project, Worktree } from '../services/projects';

interface WorkspacesSectionProps {
  activeProject: Project | null | undefined;
  session: {
    setState: (updates: Record<string, unknown>) => Promise<unknown>;
  };
  agentControllerId?: string;
  resourceId?: string;
}

export function WorkspacesSection({ activeProject, session, agentControllerId, resourceId }: WorkspacesSectionProps) {
  const [creating, setCreating] = useState(false);
  const [branch, setBranch] = useState('');
  const workspaces = useWorkspacesQuery(activeProject);
  const selectWorkspace = useSelectWorkspaceMutation(activeProject, session, { agentControllerId, resourceId });
  const createWorkspace = useCreateWorkspaceMutation(activeProject, session, { agentControllerId, resourceId });

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
        {worktrees.map(worktree => (
          <WorkspaceRow
            key={worktree.worktreePath}
            worktree={worktree}
            active={worktree.worktreePath === selectedPath}
            disabled={pending}
            onSelect={() => selectWorkspace.mutate(worktree.worktreePath)}
          />
        ))}

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
              <Txt as="span" variant="ui-xs" className="px-2 text-error">
                {createWorkspace.error instanceof Error ? createWorkspace.error.message : 'Failed to create workspace'}
              </Txt>
            )}
          </form>
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
      aria-label={worktree.branch}
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface4 disabled:cursor-not-allowed disabled:opacity-60 ${active ? 'bg-surface4' : 'bg-transparent'}`}
      title={worktree.worktreePath}
    >
      <GitBranch size={14} className="shrink-0 text-icon3" />
      <Txt as="span" variant="ui-sm" className="min-w-0 truncate text-icon6">
        {worktree.branch}
      </Txt>
    </button>
  );
}
