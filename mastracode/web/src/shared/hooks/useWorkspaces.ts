import { toast } from '@mastra/playground-ui/components/Toaster';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { createUserSession, deleteUserSession } from '../../web/ui/domains/workspaces/services/github';
import type { Factory, Worktree } from '../../web/ui/domains/workspaces/services/factories';
import {
  boardSessionWorktrees,
  isServerFactory,
  loadFactories,
  removeWorktree,
  selectedRepository,
  selectedWorktree,
  selectWorktree,
  upsertWorktree,
} from '../../web/ui/domains/workspaces/services/factories';

/**
 * The slice of the agent-controller session the delete mutation needs to
 * cascade a worktree deletion onto the threads that ran inside it.
 */
export interface WorkspaceThreadSession {
  listThreads: (opts: { limit?: number; tags?: Record<string, string> }) => Promise<Array<{ id: string }>>;
  deleteThread: (threadId: string) => Promise<unknown>;
}

interface AgentControllerThreadsScope {
  agentControllerId?: string;
  resourceId?: string;
}

export interface WorkspacesData {
  worktrees: Worktree[];
  selected: Worktree | undefined;
}

function latestFactory(factory: Factory): Factory {
  return loadFactories().find(stored => stored.id === factory.id) ?? factory;
}

export function deriveProjectPath(factory: Factory | null | undefined): string {
  if (!factory) return '';
  // The repo-root checkout is not a chat target: everything runs in a
  // worktree branched from HEAD, so a server factory without a selected
  // workspace has no project path (and no enabled chat session).
  // `projectPath` remains the SDK/TUI session tag for the execution workspace.
  if (isServerFactory(factory)) return selectedWorktree(factory)?.worktreePath ?? '';
  return factory.binding.path;
}

function invalidateWorkspaceQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  factory: Factory,
  scope?: AgentControllerThreadsScope,
) {
  const projectPath = deriveProjectPath(latestFactory(factory));
  void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(factory.id) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.agentControllerThreads(scope?.agentControllerId, scope?.resourceId, projectPath),
  });
}

function workspacesData(factory: Factory): WorkspacesData {
  const current = latestFactory(factory);
  return {
    // Board-created factory workspaces only: user-session worktrees are listed
    // by the User Sessions section, and the repo root is not a workspace at all.
    worktrees: boardSessionWorktrees(current),
    selected: selectedWorktree(current),
  };
}

export function useWorkspacesQuery(factory: Factory | null | undefined) {
  const serverFactory = factory && isServerFactory(factory) ? factory : undefined;
  return useQuery({
    queryKey: queryKeys.workspaces(factory?.id),
    queryFn: async (): Promise<WorkspacesData> => {
      if (!serverFactory) throw new Error('Workspaces query requires a server-backed factory');
      return workspacesData(serverFactory);
    },
    enabled: !!serverFactory,
    initialData: serverFactory ? () => workspacesData(serverFactory) : undefined,
  });
}

export function useSelectWorkspaceMutation(factory: Factory | null | undefined, scope?: AgentControllerThreadsScope) {
  const queryClient = useQueryClient();
  return useMutation({
    // Sessions are scoped per worktree, so selecting a worktree only updates
    // the stored factory — the UI re-derives the scope and addresses that
    // worktree's own session (no rebinding of the previous session's state).
    mutationFn: async (worktreePath: string) => {
      if (!factory) throw new Error('No active factory');
      return selectWorktree(latestFactory(factory), worktreePath);
    },
    onSuccess: updated => invalidateWorkspaceQueries(queryClient, updated, scope),
  });
}

export function useCreateWorkspaceMutation(factory: Factory | null | undefined, scope?: AgentControllerThreadsScope) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (branch: string) => {
      const trimmedBranch = branch.trim();
      if (!factory || !isServerFactory(factory)) throw new Error('No server-backed factory selected');
      const repository = selectedRepository(factory);
      if (!repository) throw new Error('Connect a repository before creating a workspace');
      const result = await createUserSession(baseUrl, repository.projectRepositoryId, trimmedBranch);
      const worktree: Worktree = {
        branch: result.branch,
        worktreePath: result.sessionId,
        baseBranch: result.baseBranch,
        threadId: result.sessionId,
      };
      return selectWorktree(upsertWorktree(latestFactory(factory), worktree), worktree.worktreePath);
    },
    onSuccess: updated => invalidateWorkspaceQueries(queryClient, updated, scope),
    onError: error => toast.error(error instanceof Error ? error.message : 'Failed to create workspace'),
  });
}

/**
 * Delete a worktree: removes the sandbox checkout + branch server-side, deletes
 * every thread that ran inside it, drops it from the stored factory, and — when
 * the deleted worktree was selected — falls back to the first remaining board
 * workspace (the UI re-derives the scope and addresses that worktree's own
 * session), or to no selection when none remain.
 * Destructive; callers confirm with the user first.
 */
export function useDeleteWorkspaceMutation(
  factory: Factory | null | undefined,
  threadSession: WorkspaceThreadSession | null | undefined,
  scope?: AgentControllerThreadsScope,
) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (worktree: Worktree) => {
      if (!factory || !isServerFactory(factory)) throw new Error('No server-backed factory selected');
      const repository = selectedRepository(factory);
      if (!repository) throw new Error('Connect a repository before deleting a workspace');
      await deleteUserSession(baseUrl, worktree.worktreePath);

      // Cascade: delete the threads scoped to this worktree. Re-list between
      // rounds since the page size caps each fetch; bail after a sane number
      // of rounds so a server hiccup can't loop forever.
      if (threadSession) {
        for (let round = 0; round < 20; round++) {
          const threads = await threadSession.listThreads({
            limit: 50,
            tags: { projectPath: worktree.worktreePath },
          });
          if (threads.length === 0) break;
          for (const thread of threads) await threadSession.deleteThread(thread.id);
        }
      }

      const wasSelected = selectedWorktree(latestFactory(factory))?.worktreePath === worktree.worktreePath;
      const updated = removeWorktree(latestFactory(factory), worktree.worktreePath);
      return { updated, removedPath: worktree.worktreePath, wasSelected };
    },
    onSuccess: ({ updated, removedPath }) => {
      invalidateWorkspaceQueries(queryClient, updated, scope);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerThreads(scope?.agentControllerId, scope?.resourceId, removedPath),
      });
      toast('Workspace deleted');
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Failed to delete workspace'),
  });
}
