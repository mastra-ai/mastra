import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, waitForMutationsIdle, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import { queryKeys } from '../../api/keys';
import type { Factory, ServerFactory } from '../../../web/ui/domains/workspaces/services/factories';
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

beforeEach(() => {
  server.use(
    http.get(`${ORIGIN}/web/github/projects/${PROJECT_REPOSITORY_ID}/worktrees`, () =>
      HttpResponse.json({ worktrees: rootFactory.binding.repositories[0]!.worktrees }),
    ),
  );
});

describe('workspaces query hooks', () => {
  it('reads repository worktrees only: user/ session entries are excluded', async () => {
    saveFactory(rootFactory);

    const { result } = renderHookWithProviders(() => useWorkspacesQuery(rootFactory));

    await waitFor(() => expect(result.current.data?.selected?.branch).toBe('feat-ui'));
    expect(result.current.data?.worktrees.map(worktree => worktree.branch)).toEqual(['feat-ui', 'feat-api']);
  });

  it('discovers server-created worktrees that are absent from local storage', async () => {
    const local: ServerFactory = {
      ...rootFactory,
      binding: {
        ...rootFactory.binding,
        repositories: rootFactory.binding.repositories.map(repository => ({ ...repository, worktrees: [] })),
      },
    };
    saveFactory(local);
    server.use(
      http.get(`${ORIGIN}/web/github/projects/${PROJECT_REPOSITORY_ID}/worktrees`, () =>
        HttpResponse.json({
          worktrees: [
            {
              branch: 'factory/issue-41',
              worktreePath: '/sandbox/mastra-worktrees/factory-issue-41',
              baseBranch: 'main',
            },
          ],
        }),
      ),
    );

    const { result } = renderHookWithProviders(() => useWorkspacesQuery(local));

    await waitFor(() => expect(result.current.data?.worktrees[0]?.branch).toBe('factory/issue-41'));
    expect(storedWorktreeBranches()).toEqual(['factory/issue-41']);
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

    expect(storedSelectedWorktreePath()).toBe('/sandbox/mastra-worktrees/feat-api');
    const cached = client.getQueryData<Factory[]>(queryKeys.factories())?.[0];
    expect(cached && isServerFactory(cached) ? selectedRepository(cached)?.selectedWorktreePath : undefined).toBe(
      '/sandbox/mastra-worktrees/feat-api',
    );
    await waitFor(() => expect(result.current.workspaces.data?.selected?.branch).toBe('feat-api'));
    await waitForMutationsIdle(client);
  });

  it('creates a workspace, upserts it, selects it, and refreshes consumers', async () => {
    saveFactory(rootFactory);
    let created = false;
    server.use(
      http.get(`${ORIGIN}/web/github/projects/${PROJECT_REPOSITORY_ID}/worktrees`, () =>
        HttpResponse.json({
          worktrees: [
            ...rootFactory.binding.repositories[0]!.worktrees,
            ...(created
              ? [
                  {
                    branch: 'feat-docs',
                    worktreePath: '/sandbox/mastra-worktrees/feat-docs',
                    baseBranch: 'main',
                  },
                ]
              : []),
          ],
        }),
      ),
      http.post(`${ORIGIN}/web/github/projects/${PROJECT_REPOSITORY_ID}/worktree`, async ({ request }) => {
        const body = (await request.json()) as { branch: string };
        expect(body.branch).toBe('feat-docs');
        created = true;
        return HttpResponse.json({
          branch: 'feat-docs',
          worktreePath: '/sandbox/mastra-worktrees/feat-docs',
          baseBranch: 'main',
          resourceId: 'resource-server',
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

    expect(storedSelectedWorktreePath()).toBe('/sandbox/mastra-worktrees/feat-docs');
    expect(storedWorktreeBranches()).toEqual(
      expect.arrayContaining(['feat-ui', 'feat-api', 'feat-docs', 'user/alice-notes']),
    );
  });

  it('deletes a workspace, cascades threads, and falls back selection', async () => {
    saveFactory(rootFactory);
    let deleted = false;
    server.use(
      http.get(`${ORIGIN}/web/github/projects/${PROJECT_REPOSITORY_ID}/worktrees`, () =>
        HttpResponse.json({
          worktrees: deleted
            ? rootFactory.binding.repositories[0]!.worktrees.filter(worktree => worktree.branch !== 'feat-ui')
            : rootFactory.binding.repositories[0]!.worktrees,
        }),
      ),
      http.post(`${ORIGIN}/web/github/projects/${PROJECT_REPOSITORY_ID}/worktree/delete`, async ({ request }) => {
        const body = (await request.json()) as { branch: string };
        expect(body.branch).toBe('feat-ui');
        deleted = true;
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
