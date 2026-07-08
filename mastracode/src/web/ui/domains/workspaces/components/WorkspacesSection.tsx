import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GitBranch, Plus } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { useSetAgentControllerStateMutation } from '../../chat/hooks/useAgentControllerStateMutations';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { useActiveProjectContext } from '../context/ActiveProjectProvider';
import { useCreateWorkspaceMutation, useSelectWorkspaceMutation, useWorkspacesQuery } from '../hooks/useWorkspaces';
import type { Worktree } from '../services/projects';

export function WorkspacesSection() {
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

  return (
    <section className="flex flex-col gap-2" aria-label="Workspaces">
      <div className="flex items-center justify-between px-1">
        <Txt as="span" variant="ui-xs" className="text-icon3 uppercase tracking-wide">
          Workspaces
        </Txt>
        <Button variant="ghost" size="icon-sm" aria-label="New workspace" onClick={() => setCreating(true)} disabled={creating || pending}>
          <Plus size={15} />
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        {worktrees.map(worktree => (
          <WorkspaceRow key={worktree.worktreePath} worktree={worktree} active={worktree.worktreePath === selectedPath} disabled={pending} onSelect={() => selectWorkspace.mutate(worktree.worktreePath)} />
        ))}

        {creating && (
          <form aria-label="Create workspace" className="flex flex-col gap-1" onSubmit={submitCreate}>
            <Input aria-label="Branch name" autoFocus value={branch} onChange={event => setBranch(event.target.value)} onKeyDown={onCreateKeyDown} placeholder="feature-branch" disabled={createWorkspace.isPending} className="h-8 text-xs" />
            {createWorkspace.error && (
              <Txt as="p" variant="ui-xs" className="m-0 text-red-400">
                {createWorkspace.error instanceof Error ? createWorkspace.error.message : 'Failed to create workspace'}
              </Txt>
            )}
          </form>
        )}
      </div>
    </section>
  );
}

function WorkspaceRow({ worktree, active, disabled, onSelect }: { worktree: Worktree; active: boolean; disabled: boolean; onSelect: () => void }) {
  return (
    <button type="button" aria-current={active ? 'true' : undefined} disabled={disabled || active} onClick={onSelect} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition ${active ? 'bg-surface4 text-icon6' : 'text-icon3 hover:bg-surface3 hover:text-icon5'} disabled:cursor-default disabled:opacity-70`}>
      <GitBranch size={13} />
      <span className="truncate">{worktree.branch}</span>
    </button>
  );
}
