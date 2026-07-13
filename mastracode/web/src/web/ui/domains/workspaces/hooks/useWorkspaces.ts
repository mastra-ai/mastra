import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../../../../../shared/api/config';
import { queryKeys } from '../../../../../shared/api/keys';
import { createWorktree } from '../services/github';
import type { Project, Worktree } from '../services/projects';
import { loadProjects, projectWorktrees, selectedWorktree, selectWorktree, upsertWorktree } from '../services/projects';

export interface WorkspaceSession {
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

export function useSelectWorkspaceMutation(
  project: Project | null | undefined,
  session: WorkspaceSession | null | undefined,
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
  session: WorkspaceSession | null | undefined,
  scope?: AgentControllerThreadsScope,
) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();

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
      const updated = selectWorktree(upsertWorktree(latestProject(project), worktree), worktree.worktreePath);
      await session?.setState({ projectPath: worktree.worktreePath });
      return updated;
    },
    onSuccess: updated => invalidateWorkspaceQueries(queryClient, updated, scope),
  });
}
