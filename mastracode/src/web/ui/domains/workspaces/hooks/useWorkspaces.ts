import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../../../../shared/api/keys';
import { useToast } from '../../../ui/toast';
import { createWorktree } from '../services/github';
import type { Project, Worktree } from '../services/projects';
import { loadProjects, projectWorktrees, selectedWorktree, selectWorktree, upsertWorktree } from '../services/projects';

interface SessionLike {
  setState: (updates: Record<string, unknown>) => Promise<unknown>;
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
  if (project.source === 'github') return selectedWorktree(project)?.worktreePath ?? project.sandboxWorkdir ?? '';
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
    worktrees: projectWorktrees(current),
    selected: selectedWorktree(current),
  };
}

export function useWorkspacesQuery(project: Project | null | undefined) {
  return useQuery({
    queryKey: queryKeys.workspaces(project?.id),
    queryFn: async (): Promise<WorkspacesData> => workspacesData(project!),
    enabled: project?.source === 'github',
    initialData: project?.source === 'github' ? () => workspacesData(project) : undefined,
  });
}

export function useSelectWorkspaceMutation(
  project: Project | null | undefined,
  session: SessionLike | null | undefined,
  scope?: AgentControllerThreadsScope,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (worktreePath: string) => {
      if (!project) throw new Error('No active project');
      const updated = selectWorktree(latestProject(project), worktreePath);
      await session?.setState({ projectPath: worktreePath });
      return updated;
    },
    onSuccess: updated => invalidateWorkspaceQueries(queryClient, updated, scope),
  });
}

export function useCreateWorkspaceMutation(
  project: Project | null | undefined,
  session: SessionLike | null | undefined,
  scope?: AgentControllerThreadsScope,
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (branch: string) => {
      const trimmedBranch = branch.trim();
      if (!project?.githubProjectId) throw new Error('No GitHub project selected');
      const result = await createWorktree(project.githubProjectId, trimmedBranch);
      const worktree: Worktree = {
        branch: result.branch,
        worktreePath: result.worktreePath,
        baseBranch: result.baseBranch,
      };
      const updated = selectWorktree(upsertWorktree(latestProject(project), worktree), worktree.worktreePath);
      await session?.setState({ projectPath: worktree.worktreePath });
      return updated;
    },
    onSuccess: updated => invalidateWorkspaceQueries(queryClient, updated, scope),
    onError: error => toast(error instanceof Error ? error.message : 'Failed to create workspace', 'error'),
  });
}
