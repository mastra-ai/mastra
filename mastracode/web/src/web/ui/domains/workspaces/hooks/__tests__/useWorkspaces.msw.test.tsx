import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, waitForMutationsIdle, TEST_BASE_URL } from '../../../../../../../e2e/web-ui/render';
import type { Project } from '../../services/projects';
import { loadProjects, saveProjects } from '../../services/projects';
import { useProjectsQuery } from '../useProjects';
import {
  deriveProjectPath,
  useCreateWorkspaceMutation,
  useDeleteWorkspaceMutation,
  useSelectWorkspaceMutation,
  useWorkspacesQuery,
} from '../useWorkspaces';
import type { WorkspaceSession, WorkspaceThreadSession } from '../useWorkspaces';

const ORIGIN = TEST_BASE_URL;
const PROJECT_ID = 'project-gh';
const GITHUB_PROJECT_ID = 'github-project-1';

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

function sessionStub() {
  return { setState: vi.fn<WorkspaceSession['setState']>().mockResolvedValue(undefined) };
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
      http.post(`${ORIGIN}/web/github/projects/${GITHUB_PROJECT_ID}/worktree`, async ({ request }) => {
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
      http.post(`${ORIGIN}/web/github/projects/${GITHUB_PROJECT_ID}/worktree`, () =>
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

  it('deletes a workspace, cascades its threads, and rebinds the session when it was selected', async () => {
    saveProject({ ...rootProject, selectedWorktreePath: '/sandbox/mastra-worktrees/feat-ui' });
    const session = sessionStub();
    let received: unknown;

    server.use(
      http.post(`${ORIGIN}/web/github/projects/${GITHUB_PROJECT_ID}/worktree/delete`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({
          removed: true,
          branch: 'feat-ui',
          worktreePath: '/sandbox/mastra-worktrees/feat-ui',
        });
      }),
    );

    const deletedThreads: string[] = [];
    let listed = false;
    const threadSession: WorkspaceThreadSession = {
      listThreads: async ({ tags }) => {
        expect(tags).toEqual({ projectPath: '/sandbox/mastra-worktrees/feat-ui' });
        if (listed) return [];
        listed = true;
        return [{ id: 'thread-1' }, { id: 'thread-2' }];
      },
      deleteThread: async threadId => {
        deletedThreads.push(threadId);
      },
    };

    const project = loadProjects()[0]!;
    const { result, client } = renderHookWithProviders(() =>
      useDeleteWorkspaceMutation(project, session, threadSession, {
        agentControllerId: 'code',
        resourceId: project.resourceId,
      }),
    );

    await act(async () => {
      await result.current.mutateAsync({
        branch: 'feat-ui',
        worktreePath: '/sandbox/mastra-worktrees/feat-ui',
        baseBranch: 'main',
      });
    });
    await waitForMutationsIdle(client);

    expect(received).toEqual({ branch: 'feat-ui' });
    expect(deletedThreads).toEqual(['thread-1', 'thread-2']);
    expect(session.setState).toHaveBeenCalledWith({ projectPath: '/sandbox/mastra' });
    const stored = loadProjects()[0]!;
    expect(stored.worktrees?.map(worktree => worktree.branch)).toEqual(['main']);
    expect(stored.selectedWorktreePath).toBe('/sandbox/mastra');
  });

  it('keeps threads and the stored worktree when the server delete fails', async () => {
    saveProject(rootProject);
    const session = sessionStub();

    server.use(
      http.post(`${ORIGIN}/web/github/projects/${GITHUB_PROJECT_ID}/worktree/delete`, () =>
        HttpResponse.json({ error: 'worktree-failed', message: 'git worktree remove failed' }, { status: 502 }),
      ),
    );

    const threadSession: WorkspaceThreadSession = {
      listThreads: vi.fn(async () => [{ id: 'thread-1' }]),
      deleteThread: vi.fn(async () => {}),
    };

    const { result } = renderHookWithProviders(() =>
      useDeleteWorkspaceMutation(rootProject, session, threadSession),
    );

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          branch: 'feat-ui',
          worktreePath: '/sandbox/mastra-worktrees/feat-ui',
          baseBranch: 'main',
        }),
      ).rejects.toMatchObject({ message: 'git worktree remove failed' });
    });

    expect(threadSession.deleteThread).not.toHaveBeenCalled();
    expect(loadProjects()[0]?.worktrees?.map(worktree => worktree.branch)).toEqual(['main', 'feat-ui']);
    expect(session.setState).not.toHaveBeenCalled();
  });

  it('does not rebind the session when deleting an unselected workspace', async () => {
    saveProject(rootProject); // selected: /sandbox/mastra (root)
    const session = sessionStub();

    server.use(
      http.post(`${ORIGIN}/web/github/projects/${GITHUB_PROJECT_ID}/worktree/delete`, () =>
        HttpResponse.json({ removed: true, branch: 'feat-ui', worktreePath: '/sandbox/mastra-worktrees/feat-ui' }),
      ),
    );

    const threadSession: WorkspaceThreadSession = {
      listThreads: vi.fn(async () => []),
      deleteThread: vi.fn(async () => {}),
    };

    const { result, client } = renderHookWithProviders(() =>
      useDeleteWorkspaceMutation(rootProject, session, threadSession),
    );

    await act(async () => {
      await result.current.mutateAsync({
        branch: 'feat-ui',
        worktreePath: '/sandbox/mastra-worktrees/feat-ui',
        baseBranch: 'main',
      });
    });
    await waitForMutationsIdle(client);

    expect(session.setState).not.toHaveBeenCalled();
    expect(loadProjects()[0]?.worktrees?.map(worktree => worktree.branch)).toEqual(['main']);
    expect(loadProjects()[0]?.selectedWorktreePath).toBe('/sandbox/mastra');
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
