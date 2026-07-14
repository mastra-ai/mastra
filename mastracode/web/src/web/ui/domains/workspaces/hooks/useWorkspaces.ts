import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../../../../../shared/api/config';
import { queryKeys } from '../../../../../shared/api/keys';
import { useToast } from '../../../ui/toast';
import { createWorktree, deleteWorktree } from '../services/github';
import type { Project, Worktree } from '../services/projects';
import {
  factoryWorktrees,
  loadProjects,
  removeWorktree,
  selectedWorktree,
  selectWorktree,
  upsertWorktree,
} from '../services/projects';

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

function latestProject(project: Project): Project {
  return loadProjects().find(stored => stored.id === project.id) ?? project;
}

export function deriveProjectPath(project: Project | null | undefined): string {
  if (!project) return '';
  // The repo-root checkout is not a chat target: everything runs in a
  // worktree branched from HEAD, so a GitHub project without a selected
  // workspace has no project path (and no enabled chat session).
  if (project.source === 'github') return selectedWorktree(project)?.worktreePath ?? '';
  return project.path ?? '';
}

function invalidateWorkspaceQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  project: Project,
  scope?: AgentControllerThreadsScope,
) {
  const projectPath = deriveProjectPath(latestProject(project));
  void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces(project.id) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
  void queryClient.invalidateQueries({
    queryKey: queryKeys.agentControllerThreads(scope?.agentControllerId, scope?.resourceId, projectPath),
  });
}

function workspacesData(project: Project): WorkspacesData {
  const current = latestProject(project);
  return {
    // Factory workspaces only: user-session worktrees are listed by the
    // User Sessions section, and the repo root is not a workspace at all.
    worktrees: factoryWorktrees(current),
    selected: selectedWorktree(current),
  };
}

export function useWorkspacesQuery(project: Project | null | undefined) {
  const githubProject = project?.source === 'github' ? project : undefined;
  return useQuery({
    queryKey: queryKeys.workspaces(project?.id),
    queryFn: async (): Promise<WorkspacesData> => {
      if (!githubProject) throw new Error('Workspaces query requires a GitHub project');
      return workspacesData(githubProject);
    },
    enabled: !!githubProject,
    initialData: githubProject ? () => workspacesData(githubProject) : undefined,
  });
}

export function useSelectWorkspaceMutation(project: Project | null | undefined, scope?: AgentControllerThreadsScope) {
  const queryClient = useQueryClient();
  return useMutation({
    // Sessions are scoped per worktree, so selecting a worktree only updates
    // the stored project — the UI re-derives the scope and addresses that
    // worktree's own session (no rebinding of the previous session's state).
    mutationFn: async (worktreePath: string) => {
      if (!project) throw new Error('No active project');
      return selectWorktree(latestProject(project), worktreePath);
    },
    onSuccess: updated => invalidateWorkspaceQueries(queryClient, updated, scope),
  });
}

export function useCreateWorkspaceMutation(project: Project | null | undefined, scope?: AgentControllerThreadsScope) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (branch: string) => {
      const trimmedBranch = branch.trim();
      if (!project?.githubProjectId) throw new Error('No GitHub project selected');
      const result = await createWorktree(baseUrl, project.githubProjectId, trimmedBranch);
      const worktree: Worktree = {
        branch: result.branch,
        worktreePath: result.worktreePath,
        baseBranch: result.baseBranch,
      };
      return selectWorktree(upsertWorktree(latestProject(project), worktree), worktree.worktreePath);
    },
    onSuccess: updated => invalidateWorkspaceQueries(queryClient, updated, scope),
    onError: error => toast(error instanceof Error ? error.message : 'Failed to create workspace', 'error'),
  });
}

/**
 * Delete a worktree: removes the sandbox checkout + branch server-side, deletes
 * every thread that ran inside it, drops it from the stored project, and — when
 * the deleted worktree was selected — falls back to the first remaining factory
 * workspace (the UI re-derives the scope and addresses that worktree's own
 * session), or to no selection when none remain.
 * Destructive; callers confirm with the user first.
 */
export function useDeleteWorkspaceMutation(
  project: Project | null | undefined,
  threadSession: WorkspaceThreadSession | null | undefined,
  scope?: AgentControllerThreadsScope,
) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (worktree: Worktree) => {
      if (!project?.githubProjectId) throw new Error('No GitHub project selected');
      await deleteWorktree(baseUrl, project.githubProjectId, worktree.branch);

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

      const wasSelected = selectedWorktree(latestProject(project))?.worktreePath === worktree.worktreePath;
      const updated = removeWorktree(latestProject(project), worktree.worktreePath);
      return { updated, removedPath: worktree.worktreePath, wasSelected };
    },
    onSuccess: ({ updated, removedPath }) => {
      invalidateWorkspaceQueries(queryClient, updated, scope);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerThreads(scope?.agentControllerId, scope?.resourceId, removedPath),
      });
      toast('Workspace deleted');
    },
    onError: error => toast(error instanceof Error ? error.message : 'Failed to delete workspace', 'error'),
  });
}
