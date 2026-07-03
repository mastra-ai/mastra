import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, waitForMutationsIdle } from '../../../../../../../e2e/web-ui/render';
import type { Project } from '../../services/projects';
import { loadProjects, saveProjects } from '../../services/projects';
import { useProjectsQuery } from '../useProjects';
import {
  deriveProjectPath,
  useCreateWorkspaceMutation,
  useSelectWorkspaceMutation,
  useWorkspacesQuery,
} from '../useWorkspaces';

const ORIGIN = 'http://localhost:3000';
const PROJECT_ID = 'project-gh';
const GITHUB_PROJECT_ID = 'github-project-1';

interface SessionStub {
  setState: (updates: Record<string, unknown>) => Promise<void>;
}

const rootProject: Project = {
  id: PROJECT_ID,
  name: 'Mastra',
  source: 'github',
  githubProjectId: GITHUB_PROJECT_ID,
  sandboxWorkdir: '/sandbox/mastra',
  resourceId: 'resource-gh',
  gitBranch: 'main',
  worktrees: [
    { branch: 'main', worktreePath: '/sandbox/mastra', baseBranch: 'main' },
    { branch: 'feat-ui', worktreePath: '/sandbox/mastra-worktrees/feat-ui', baseBranch: 'main' },
  ],
  selectedWorktreePath: '/sandbox/mastra',
  createdAt: 1,
};

function saveProject(project: Project) {
  saveProjects([project]);
}

function sessionStub(): SessionStub {
  return { setState: vi.fn<SessionStub['setState']>().mockResolvedValue(undefined) };
}

describe('workspaces query hooks', () => {
  it('reads GitHub project worktrees through React Query', async () => {
    saveProject(rootProject);

    const { result } = renderHookWithProviders(() => useWorkspacesQuery(rootProject));

    await waitFor(() => expect(result.current.data?.selected?.branch).toBe('main'));
    expect(result.current.data?.worktrees.map(worktree => worktree.branch)).toEqual(['main', 'feat-ui']);
  });

  it('selects a workspace, persists it, rebinds the session projectPath, and refreshes projects consumers', async () => {
    saveProject(rootProject);
    const session = sessionStub();

    const { result, client } = renderHookWithProviders(() => {
      const projects = useProjectsQuery();
      const workspaces = useWorkspacesQuery(rootProject);
      const selectWorkspace = useSelectWorkspaceMutation(rootProject, session, {
        agentControllerId: 'code',
        resourceId: rootProject.resourceId,
      });
      return { projects, workspaces, selectWorkspace };
    });

    await waitFor(() => expect(result.current.workspaces.data?.selected?.branch).toBe('main'));

    await act(async () => {
      await result.current.selectWorkspace.mutateAsync('/sandbox/mastra-worktrees/feat-ui');
    });
    await waitForMutationsIdle(client);

    expect(session.setState).toHaveBeenCalledWith({ projectPath: '/sandbox/mastra-worktrees/feat-ui' });
    expect(loadProjects()[0]?.selectedWorktreePath).toBe('/sandbox/mastra-worktrees/feat-ui');
    await waitFor(() => expect(result.current.workspaces.data?.selected?.branch).toBe('feat-ui'));
    await waitFor(() =>
      expect(result.current.projects.data[0]?.selectedWorktreePath).toBe('/sandbox/mastra-worktrees/feat-ui'),
    );
  });

  it('creates a workspace, persists it, selects it, and refetches the workspaces query', async () => {
    saveProject(rootProject);
    const session = sessionStub();
    let received: unknown;

    server.use(
      http.post(`${ORIGIN}/api/web/github/projects/${GITHUB_PROJECT_ID}/worktree`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({
          branch: 'feat-new',
          worktreePath: '/sandbox/mastra-worktrees/feat-new',
          baseBranch: 'main',
          resourceId: 'resource-gh',
        });
      }),
    );

    const { result, client } = renderHookWithProviders(() => {
      const workspaces = useWorkspacesQuery(rootProject);
      const createWorkspace = useCreateWorkspaceMutation(rootProject, session, {
        agentControllerId: 'code',
        resourceId: rootProject.resourceId,
      });
      return { workspaces, createWorkspace };
    });

    await waitFor(() => expect(result.current.workspaces.data?.worktrees).toHaveLength(2));

    await act(async () => {
      await result.current.createWorkspace.mutateAsync('feat-new');
    });
    await waitForMutationsIdle(client);

    expect(received).toEqual({ branch: 'feat-new' });
    expect(session.setState).toHaveBeenCalledWith({ projectPath: '/sandbox/mastra-worktrees/feat-new' });
    await waitFor(() => expect(result.current.workspaces.data?.selected?.branch).toBe('feat-new'));
    expect(result.current.workspaces.data?.worktrees.map(worktree => worktree.branch)).toEqual([
      'main',
      'feat-ui',
      'feat-new',
    ]);
  });

  it('keeps the current selection when creating a workspace fails', async () => {
    saveProject(rootProject);
    const session = sessionStub();

    server.use(
      http.post(`${ORIGIN}/api/web/github/projects/${GITHUB_PROJECT_ID}/worktree`, () =>
        HttpResponse.json({ error: 'Invalid branch', message: 'branch name is invalid' }, { status: 400 }),
      ),
    );

    const { result } = renderHookWithProviders(() => useCreateWorkspaceMutation(rootProject, session));

    await act(async () => {
      await expect(result.current.mutateAsync('bad branch')).rejects.toMatchObject({
        message: 'branch name is invalid',
      });
    });

    expect(loadProjects()[0]?.selectedWorktreePath).toBe('/sandbox/mastra');
    expect(session.setState).not.toHaveBeenCalled();
  });

  it('derives the active projectPath from the selected GitHub worktree', () => {
    expect(deriveProjectPath(rootProject)).toBe('/sandbox/mastra');
    expect(deriveProjectPath({ ...rootProject, selectedWorktreePath: '/sandbox/mastra-worktrees/feat-ui' })).toBe(
      '/sandbox/mastra-worktrees/feat-ui',
    );
    expect(deriveProjectPath({ ...rootProject, worktrees: [], selectedWorktreePath: undefined })).toBe(
      '/sandbox/mastra',
    );
  });
});
