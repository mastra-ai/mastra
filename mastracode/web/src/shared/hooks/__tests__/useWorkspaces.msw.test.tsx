import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, waitForMutationsIdle, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import type { GithubFactory } from '../../../web/ui/domains/workspaces/services/factories';
import { isGithubFactory, loadFactories, saveFactories } from '../../../web/ui/domains/workspaces/services/factories';
import { useFactoriesQuery } from '../useFactories';
import {
  deriveProjectPath,
  useCreateWorkspaceMutation,
  useDeleteWorkspaceMutation,
  useSelectWorkspaceMutation,
  useWorkspacesQuery,
} from '../useWorkspaces';
import type { WorkspaceThreadSession } from '../useWorkspaces';

const ORIGIN = TEST_BASE_URL;
const FACTORY_ID = 'factory-gh';
const GITHUB_PROJECT_ID = 'github-project-1';

// The persisted shape intentionally includes a personal user-session worktree:
// it is not a board workspace, so it must be filtered out of the workspaces data.
const rootFactory: GithubFactory = {
  id: FACTORY_ID,
  name: 'Mastra',
  resourceId: 'resource-gh',
  createdAt: 1,
  binding: {
    kind: 'github',
    githubProjectId: GITHUB_PROJECT_ID,
    gitBranch: 'main',
    sandboxWorkdir: '/sandbox/mastra',
    worktrees: [
      { branch: 'feat-ui', worktreePath: '/sandbox/mastra-worktrees/feat-ui', baseBranch: 'main' },
      { branch: 'feat-api', worktreePath: '/sandbox/mastra-worktrees/feat-api', baseBranch: 'main' },
      {
        branch: 'user/alice-notes',
        worktreePath: '/sandbox/mastra-worktrees/user-alice-notes',
        baseBranch: 'main',
        threadId: 'thread-user',
      },
    ],
    selectedWorktreePath: '/sandbox/mastra-worktrees/feat-ui',
  },
};

function saveFactory(factory: GithubFactory) {
  saveFactories([factory]);
}

describe('workspaces query hooks', () => {
  it('reads factory worktrees only: user/ session entries are excluded', async () => {
    saveFactory(rootFactory);

    const { result } = renderHookWithProviders(() => useWorkspacesQuery(rootFactory));

    await waitFor(() => expect(result.current.data?.selected?.branch).toBe('feat-ui'));
    expect(result.current.data?.worktrees.map(worktree => worktree.branch)).toEqual(['feat-ui', 'feat-api']);
  });

  it('selects a workspace, persists it, and refreshes factory consumers', async () => {
    saveFactory(rootFactory);

    const { result, client } = renderHookWithProviders(() => {
      const factories = useFactoriesQuery();
      const workspaces = useWorkspacesQuery(rootFactory);
      const selectWorkspace = useSelectWorkspaceMutation(rootFactory, {
        agentControllerId: 'code',
        resourceId: rootFactory.resourceId,
      });
      return { factories, workspaces, selectWorkspace };
    });

    await waitFor(() => expect(result.current.workspaces.data?.selected?.branch).toBe('feat-ui'));

    await act(async () => {
      await result.current.selectWorkspace.mutateAsync('/sandbox/mastra-worktrees/feat-api');
    });
    await waitForMutationsIdle(client);

    const stored = loadFactories()[0];
    expect(isGithubFactory(stored!) && stored.binding.selectedWorktreePath).toBe('/sandbox/mastra-worktrees/feat-api');
    await waitFor(() => expect(result.current.workspaces.data?.selected?.branch).toBe('feat-api'));
  });

  it('creates a workspace, upserts it, selects it, and refreshes consumers', async () => {
    saveFactory(rootFactory);
    server.use(
      http.post(`${ORIGIN}/web/github/repositories/${GITHUB_PROJECT_ID}/worktree`, async ({ request }) => {
        const body = (await request.json()) as { branch: string };
        expect(body.branch).toBe('feat-docs');
        return HttpResponse.json({
          branch: 'feat-docs',
          worktreePath: '/sandbox/mastra-worktrees/feat-docs',
          baseBranch: 'main',
        });
      }),
    );

    const { result, client } = renderHookWithProviders(() => {
      const workspaces = useWorkspacesQuery(rootFactory);
      const createWorkspace = useCreateWorkspaceMutation(rootFactory, {
        agentControllerId: 'code',
        resourceId: rootFactory.resourceId,
      });
      return { workspaces, createWorkspace };
    });

    await act(async () => {
      await result.current.createWorkspace.mutateAsync('feat-docs');
    });
    await waitForMutationsIdle(client);

    const stored = loadFactories()[0];
    expect(isGithubFactory(stored!)).toBe(true);
    if (!isGithubFactory(stored!)) throw new Error('expected github factory');
    expect(stored.binding.selectedWorktreePath).toBe('/sandbox/mastra-worktrees/feat-docs');
    expect(stored.binding.worktrees.map(worktree => worktree.branch)).toEqual(
      expect.arrayContaining(['feat-ui', 'feat-api', 'feat-docs', 'user/alice-notes']),
    );
  });

  it('deletes a workspace, cascades threads, and falls back selection', async () => {
    saveFactory(rootFactory);
    server.use(
      http.post(`${ORIGIN}/web/github/repositories/${GITHUB_PROJECT_ID}/worktree/delete`, async ({ request }) => {
        const body = (await request.json()) as { branch: string };
        expect(body.branch).toBe('feat-ui');
        return HttpResponse.json({ ok: true });
      }),
    );

    const listThreads = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'thread-1' }, { id: 'thread-2' }])
      .mockResolvedValueOnce([]);
    const deleteThread = vi.fn().mockResolvedValue(undefined);
    const threadSession: WorkspaceThreadSession = { listThreads, deleteThread };

    const { result, client } = renderHookWithProviders(() => {
      const workspaces = useWorkspacesQuery(rootFactory);
      const deleteWorkspace = useDeleteWorkspaceMutation(rootFactory, threadSession, {
        agentControllerId: 'code',
        resourceId: rootFactory.resourceId,
      });
      return { workspaces, deleteWorkspace };
    });

    await act(async () => {
      await result.current.deleteWorkspace.mutateAsync({
        branch: 'feat-ui',
        worktreePath: '/sandbox/mastra-worktrees/feat-ui',
        baseBranch: 'main',
      });
    });
    await waitForMutationsIdle(client);

    expect(listThreads).toHaveBeenCalled();
    expect(deleteThread).toHaveBeenCalledWith('thread-1');
    expect(deleteThread).toHaveBeenCalledWith('thread-2');

    const stored = loadFactories()[0];
    expect(isGithubFactory(stored!)).toBe(true);
    if (!isGithubFactory(stored!)) throw new Error('expected github factory');
    expect(stored.binding.worktrees.map(worktree => worktree.branch)).toEqual(['feat-api', 'user/alice-notes']);
    expect(stored.binding.selectedWorktreePath).toBe('/sandbox/mastra-worktrees/feat-api');
  });

  it('derives projectPath from the selected worktree for GitHub factories', () => {
    expect(deriveProjectPath(rootFactory)).toBe('/sandbox/mastra-worktrees/feat-ui');
    expect(
      deriveProjectPath({
        id: 'factory-local',
        name: 'Local',
        resourceId: 'resource-local',
        createdAt: 1,
        binding: { kind: 'local', path: '/repo/local' },
      }),
    ).toBe('/repo/local');
  });
});
