import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, waitForMutationsIdle, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import type { ServerFactory } from '../../../web/ui/domains/workspaces/services/factories';
import {
  isServerFactory,
  loadFactories,
  saveFactories,
  selectedRepository,
} from '../../../web/ui/domains/workspaces/services/factories';
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
const FACTORY_ID = 'factory-server';
const PROJECT_REPOSITORY_ID = 'pr-1';

// The persisted shape intentionally includes a personal user-session worktree:
// it is not a board workspace, so it must be filtered out of the workspaces data.
const rootFactory: ServerFactory = {
  id: FACTORY_ID,
  name: 'Mastra',
  resourceId: 'resource-server',
  createdAt: 1,
  binding: {
    kind: 'factory',
    factoryProjectId: 'fp-1',
    selectedRepositoryId: PROJECT_REPOSITORY_ID,
    repositories: [
      {
        projectRepositoryId: PROJECT_REPOSITORY_ID,
        slug: 'acme/mastra',
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
    ],
  },
};

function saveFactory(factory: ServerFactory) {
  saveFactories([factory]);
}

function storedSelectedWorktreePath(): string | undefined {
  const stored = loadFactories()[0];
  if (!stored || !isServerFactory(stored)) throw new Error('expected server factory');
  return selectedRepository(stored)?.selectedWorktreePath;
}

function storedWorktreeBranches(): string[] {
  const stored = loadFactories()[0];
  if (!stored || !isServerFactory(stored)) throw new Error('expected server factory');
  return (selectedRepository(stored)?.worktrees ?? []).map(worktree => worktree.branch);
}

describe('workspaces query hooks', () => {
  it('reads repository worktrees only: user/ session entries are excluded', async () => {
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

    expect(storedSelectedWorktreePath()).toBe('/sandbox/mastra-worktrees/feat-api');
    await waitFor(() => expect(result.current.workspaces.data?.selected?.branch).toBe('feat-api'));
  });

  it('creates a workspace, upserts it, selects it, and refreshes consumers', async () => {
    saveFactory(rootFactory);
    server.use(
      http.post(`${ORIGIN}/web/github/projects/${PROJECT_REPOSITORY_ID}/sessions`, async ({ request }) => {
        const body = (await request.json()) as { branch: string };
        expect(body.branch).toBe('feat-docs');
        return HttpResponse.json({
          session: {
            id: 'stored-feat-docs',
            sessionId: 'session-feat-docs',
            projectRepositoryId: PROJECT_REPOSITORY_ID,
            orgId: 'org-1',
            userId: 'user-1',
            branch: 'feat-docs',
            baseBranch: 'main',
            sandboxId: null,
            sandboxWorkdir: null,
            materializedAt: null,
            createdAt: '2026-07-22T00:00:00.000Z',
            updatedAt: '2026-07-22T00:00:00.000Z',
          },
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

    expect(storedSelectedWorktreePath()).toBe('session-feat-docs');
    expect(storedWorktreeBranches()).toEqual(
      expect.arrayContaining(['feat-ui', 'feat-api', 'feat-docs', 'user/alice-notes']),
    );
  });

  it('deletes a workspace, cascades threads, and falls back selection', async () => {
    saveFactory(rootFactory);
    server.use(
      http.delete(`${ORIGIN}/web/user-sessions/${encodeURIComponent('/sandbox/mastra-worktrees/feat-ui')}`, () =>
        HttpResponse.json({ removed: true }),
      ),
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

    expect(storedWorktreeBranches()).toEqual(['feat-api', 'user/alice-notes']);
    expect(storedSelectedWorktreePath()).toBe('/sandbox/mastra-worktrees/feat-api');
  });

  it('derives projectPath from the selected worktree for server factories', () => {
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
