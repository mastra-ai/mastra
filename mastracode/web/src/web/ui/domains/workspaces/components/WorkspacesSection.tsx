import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { useWorkspaceActivity, useWorkspaceThreadTitles } from '../../../../../shared/hooks/useWorkspaceActivity';
import { useWorkspaceAttention } from '../../../../../shared/hooks/useWorkspaceAttention';
import { useWorkItemsQuery } from '../../../../../shared/hooks/useWorkItems';
import { useDeleteWorkspaceMutation, useWorkspacesQuery } from '../../../../../shared/hooks/useWorkspaces';
import { useChatSessionContext } from '../../chat/context/useChatSessionContext';
import { createAgentControllerClient } from '../../chat/services/agentControllerClient';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import type { FactoryUserSession } from '../services/github';
import { SessionNavRow } from './SessionNavRow';

export function WorkspacesSection() {
  const { factoryId, sessionId } = useParams<{ factoryId: string; sessionId: string }>();
  const { baseUrl, resourceId, sessionEnabled, factorySessionState } = useChatSessionContext();
  const projectRepositoryId = factorySessionState?.projectRepositoryId;
  const workspaces = useWorkspacesQuery(projectRepositoryId);
  const navigate = useNavigate();
  const location = useLocation();
  const scope = { agentControllerId: AGENT_CONTROLLER_ID, resourceId };
  const { session } = createAgentControllerClient({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: sessionId,
    baseUrl,
    enabled: sessionEnabled,
  });
  const deleteWorkspace = useDeleteWorkspaceMutation(factoryId, projectRepositoryId, session, scope);
  const [confirmDelete, setConfirmDelete] = useState<FactoryUserSession | null>(null);
  const workItems = useWorkItemsQuery(factoryId);
  const workspaceRows = workspaces.data?.workspaces ?? [];
  const activityOptions = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: sessionId,
    worktreePaths: workspaceRows.map(workspace => workspace.sessionId),
    baseUrl,
    enabled: sessionEnabled && Boolean(sessionId),
  };
  const runningByPath = useWorkspaceActivity(activityOptions);
  const titleByPath = useWorkspaceThreadTitles(activityOptions);
  const { attentionByPath, clearAttention } = useWorkspaceAttention(runningByPath);

  const allWorkItems = workItems.data ?? [];
  const workItemByPath = new Map(
    allWorkItems.flatMap(item =>
      Object.values(item.sessions ?? {}).map(sessionRef => [sessionRef.sessionId, item] as const),
    ),
  );
  const rows = workspaceRows.flatMap(workspace => {
    const item = workItemByPath.get(workspace.sessionId);
    const active = workspace.sessionId === sessionId;
    const running = runningByPath[workspace.sessionId] === true;
    const factorySession = !workspace.branch.startsWith('user/');
    if (!item && !active && !running && (!factorySession || !workItems.isFetched)) return [];
    return [
      {
        workspace,
        url: `/factories/${factoryId}/workspaces/${workspace.sessionId}`,
        label: titleByPath[workspace.sessionId],
        active,
        running,
        attention: attentionByPath[workspace.sessionId] === true,
        review: item?.source === 'github-pr' || (!item && workspace.branch.startsWith('factory/pr-')),
        updatedAt: item?.updatedAt ?? workspace.updatedAt,
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

  if (workRows.length === 0 && reviewRows.length === 0) return null;

  return (
    <section className="flex flex-col gap-4" aria-label="Factory sessions">
      {workRows.length > 0 && (
        <WorkspaceGroup
          title="Work Sessions"
          rows={workRows}
          pending={pending}
          onSelect={openWorkspaceThread}
          onDelete={setConfirmDelete}
        />
      )}
      {reviewRows.length > 0 && (
        <WorkspaceGroup
          title="Review Sessions"
          rows={reviewRows}
          pending={pending}
          onSelect={openWorkspaceThread}
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
  onSelect: (workspace: FactoryUserSession) => void;
  onDelete: (workspace: FactoryUserSession) => void;
}) {
  return (
    <section className="flex flex-col gap-2" aria-label={title}>
      <div className="flex items-center px-1">
        <Txt as="span" variant="ui-xs" className="text-icon3 uppercase tracking-wide">
          {title}
        </Txt>
      </div>
      <MainSidebar.NavList>
        {rows.map(row => (
          <SessionNavRow
            key={row.workspace.sessionId}
            name={row.label ?? row.workspace.branch}
            title={row.workspace.branch}
            url={row.url}
            active={row.active}
            disabled={pending}
            status={row.running ? 'running' : row.attention ? 'attention' : undefined}
            onSelect={() => onSelect(row.workspace)}
            onDelete={() => onDelete(row.workspace)}
          />
        ))}
      </MainSidebar.NavList>
    </section>
  );
}
