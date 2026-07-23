import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useQueryClient } from '@tanstack/react-query';
import { GitBranch, MoreHorizontal, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../../../../../shared/api/keys';
import { AGENT_CONTROLLER_THREAD_PAGE_SIZE } from '../../../../../shared/hooks/useAgentControllerThreads';
import {
  conversationThread,
  useWorkspaceActivity,
  useWorkspaceThreadTitles,
} from '../../../../../shared/hooks/useWorkspaceActivity';
import { useWorkspaceAttention } from '../../../../../shared/hooks/useWorkspaceAttention';
import { useWorkItemsQuery } from '../../../../../shared/hooks/useWorkItems';
import { useDeleteWorkspaceMutation, useWorkspacesQuery } from '../../../../../shared/hooks/useWorkspaces';
import { useChatSessionContext } from '../../chat/context/useChatSessionContext';
import { createAgentControllerClient, requireAgentControllerSession } from '../../chat/services/agentControllerClient';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import type { FactoryUserSession } from '../services/github';

export function WorkspacesSection() {
  const { factoryId, sessionId } = useParams<{ factoryId: string; sessionId: string }>();
  const { baseUrl, resourceId, sessionEnabled, factorySessionState } = useChatSessionContext();
  const projectRepositoryId = factorySessionState?.projectRepositoryId;
  const workspaces = useWorkspacesQuery(projectRepositoryId);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
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

  const openWorkspaceThread = async (workspace: FactoryUserSession) => {
    clearAttention(workspace.sessionId);
    try {
      // Workspace sessions (and their threads) live under the session's own id
      // as the memory resourceId with no scope — see FactoryStartCoordinator.
      const { session: targetSession } = createAgentControllerClient({
        agentControllerId: AGENT_CONTROLLER_ID,
        resourceId: workspace.sessionId,
        baseUrl,
        enabled: sessionEnabled,
      });
      const chatSession = requireAgentControllerSession(targetSession);
      await chatSession.create({});
      const threadsKey = queryKeys.agentControllerThreads(AGENT_CONTROLLER_ID, workspace.sessionId, undefined);
      const threads = await queryClient.fetchQuery({
        queryKey: threadsKey,
        queryFn: () => chatSession.listThreads({ limit: AGENT_CONTROLLER_THREAD_PAGE_SIZE }),
      });
      const thread = conversationThread(threads)?.id;
      if (thread) {
        const messagesKey = queryKeys.agentControllerThreadMessages(
          AGENT_CONTROLLER_ID,
          workspace.sessionId,
          thread,
          INITIAL_THREAD_MESSAGE_LIMIT,
        );
        void queryClient.prefetchQuery({
          queryKey: messagesKey,
          queryFn: () => chatSession.listMessages(thread, INITIAL_THREAD_MESSAGE_LIMIT),
        });
        void navigate(`/factories/${factoryId}/workspaces/${workspace.sessionId}/threads/${thread}`, {
          state: { from: location },
        });
      } else {
        void navigate(`/factories/${factoryId}/workspaces/${workspace.sessionId}`, { state: { from: location } });
      }
    } catch {
      void navigate(`/factories/${factoryId}/workspaces/${workspace.sessionId}`, { state: { from: location } });
    }
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
      <div className="flex flex-col gap-1">
        {rows.map(row => (
          <WorkspaceRow
            key={row.workspace.sessionId}
            workspace={row.workspace}
            label={row.label}
            active={row.active}
            running={row.running}
            attention={row.attention}
            disabled={pending}
            onSelect={() => onSelect(row.workspace)}
            onDelete={() => onDelete(row.workspace)}
          />
        ))}
      </div>
    </section>
  );
}

export function WorkspaceRow({
  workspace,
  label,
  active,
  running,
  attention,
  disabled,
  onSelect,
  onDelete,
}: {
  workspace: FactoryUserSession;
  label?: string;
  active: boolean;
  running: boolean;
  attention: boolean;
  disabled: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  const name = label ?? workspace.branch;
  return (
    <div className={`group relative rounded-md ${active ? 'bg-surface4' : 'hover:bg-surface3'}`}>
      <button
        type="button"
        aria-current={active ? 'true' : undefined}
        aria-label={name}
        disabled={disabled}
        onClick={onSelect}
        title={workspace.branch}
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
              <Trash2 />
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
      )}
    </div>
  );
}
