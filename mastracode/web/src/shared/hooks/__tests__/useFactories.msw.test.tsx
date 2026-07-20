import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, waitForMutationsIdle, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import type { Factory, GithubFactory, LocalFactory } from '../../../web/ui/domains/workspaces/services/factories';
import {
  loadActiveFactoryId,
  loadFactories,
  saveActiveFactoryId,
  saveFactories,
} from '../../../web/ui/domains/workspaces/services/factories';
import { useActiveFactory } from '../useActiveFactory';
import {
  useAddFactoryMutation,
  useCreateGithubFactoryMutation,
  useFactoriesQuery,
  useRemoveFactoryMutation,
} from '../useFactories';

const ORIGIN = TEST_BASE_URL;

const localFactory: LocalFactory = {
  id: 'factory-local',
  name: 'Mastra',
  resourceId: 'resource-local',
  createdAt: 1,
  binding: {
    kind: 'local',
    path: '/repo/mastra',
    gitBranch: 'main',
  },
};

const githubFactory: GithubFactory = {
  id: 'factory-gh',
  name: 'acme/mastra',
  createdAt: 2,
  binding: {
    kind: 'github',
    githubProjectId: 'github-project-1',
    worktrees: [],
  },
};

const githubRepositoryPayload = {
  id: 'github-project-1',
  name: 'mastra',
  source: 'github' as const,
  githubProjectId: 'github-project-1',
  resourceId: 'github-project-1',
  gitBranch: 'main',
  sandboxWorkdir: '/workspace/acme/mastra',
  worktrees: [],
  createdAt: 2,
};

beforeEach(() => {
  localStorage.clear();
});

describe('factories query hooks', () => {
  it('reads persisted factories through React Query', async () => {
    saveFactories([localFactory]);

    const { result } = renderHookWithProviders(() => useFactoriesQuery());

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data[0]).toMatchObject({ id: 'factory-local', name: 'Mastra' });
  });

  it('hydrates GitHub factories from source-control-backed repositories while preserving browser identity', async () => {
    saveFactories([
      localFactory,
      {
        ...githubFactory,
        binding: {
          ...githubFactory.binding,
          selectedWorktreePath: '/workspace/worktrees/stale',
          worktrees: [
            {
              branch: 'feature/one',
              baseBranch: 'main',
              worktreePath: '/workspace/worktrees/one',
              threadId: 'thread-1',
            },
          ],
        },
      },
    ]);
    server.use(
      http.get(`${ORIGIN}/web/github/repositories`, () =>
        HttpResponse.json([
          {
            ...githubRepositoryPayload,
            worktrees: [{ branch: 'feature/one', baseBranch: 'main', worktreePath: '/workspace/worktrees/one' }],
          },
        ]),
      ),
    );

    const { result } = renderHookWithProviders(() => useFactoriesQuery());

    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.data).toEqual([
      localFactory,
      {
        id: 'factory-gh',
        name: 'mastra',
        resourceId: 'github-project-1',
        createdAt: 2,
        binding: {
          kind: 'github',
          githubProjectId: 'github-project-1',
          gitBranch: 'main',
          sandboxId: undefined,
          sandboxWorkdir: '/workspace/acme/mastra',
          selectedWorktreePath: undefined,
          worktrees: [
            {
              branch: 'feature/one',
              baseBranch: 'main',
              worktreePath: '/workspace/worktrees/one',
              threadId: 'thread-1',
            },
          ],
        },
      },
    ]);
    expect(loadFactories()).toEqual(result.current.data);
  });

  it('adds a local factory, persists it, and refreshes factory query consumers', async () => {
    saveFactories([localFactory]);
    server.use(
      http.get(`${ORIGIN}/web/codebase/resolve`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('path')).toBe('/repo/new-app');
        return HttpResponse.json({
          resourceId: 'resource-new',
          name: 'New App',
          rootPath: '/repo/new-app',
          gitBranch: 'main',
        });
      }),
    );

    const { result, client } = renderHookWithProviders(() => {
      const factories = useFactoriesQuery();
      const addLocalFactory = useAddFactoryMutation();
      return { factories, addLocalFactory };
    });

    await waitFor(() => expect(result.current.factories.data).toHaveLength(1));

    await act(async () => {
      await result.current.addLocalFactory.mutateAsync({ name: 'New App', path: '/repo/new-app' });
    });
    await waitForMutationsIdle(client);

    const stored = loadFactories().find(factory => factory.name === 'New App');
    expect(stored).toMatchObject({
      name: 'New App',
      resourceId: 'resource-new',
      binding: { kind: 'local', path: '/repo/new-app', gitBranch: 'main' },
    });
    expect(stored).not.toHaveProperty('path');
    expect(stored).not.toHaveProperty('source');
    expect(stored).not.toHaveProperty('rootPath');
    expect(stored).not.toHaveProperty('gitUrl');
    await waitFor(() =>
      expect(result.current.factories.data.map(factory => factory.name)).toEqual(['Mastra', 'New App']),
    );
  });

  it('removes the active factory, clears active id, and refreshes factory query consumers', async () => {
    saveFactories([localFactory, { ...githubFactory, resourceId: 'resource-gh' }]);
    saveActiveFactoryId(localFactory.id);
    server.use(http.get(`${ORIGIN}/web/github/repositories`, () => HttpResponse.json([githubRepositoryPayload])));

    const { result, client } = renderHookWithProviders(() => {
      const factories = useFactoriesQuery();
      const removeFactory = useRemoveFactoryMutation();
      return { factories, removeFactory };
    });

    await waitFor(() => expect(result.current.factories.data).toHaveLength(2));

    await act(async () => {
      result.current.removeFactory.mutate(localFactory.id);
    });
    await waitForMutationsIdle(client);

    expect(loadFactories().map(factory => factory.id)).toEqual(['factory-gh']);
    expect(loadActiveFactoryId()).toBeNull();
    await waitFor(() => expect(result.current.factories.data.map(factory => factory.id)).toEqual(['factory-gh']));
  });

  it('deletes a GitHub repository from the backend before removing its browser factory', async () => {
    saveFactories([githubFactory]);
    let connected = true;
    server.use(
      http.get(`${ORIGIN}/web/github/repositories`, () =>
        HttpResponse.json(connected ? [githubRepositoryPayload] : []),
      ),
      http.delete(`${ORIGIN}/web/github/repositories/github-project-1`, () => {
        expect(loadFactories().some(factory => factory.id === githubFactory.id)).toBe(true);
        connected = false;
        return HttpResponse.json({ deleted: true });
      }),
    );

    const { result, client } = renderHookWithProviders(() => {
      const factories = useFactoriesQuery();
      const removeFactory = useRemoveFactoryMutation();
      return { factories, removeFactory };
    });
    await waitFor(() => expect(result.current.factories.isFetching).toBe(false));

    await act(async () => {
      await result.current.removeFactory.mutateAsync(githubFactory.id);
    });
    await waitForMutationsIdle(client);

    expect(loadFactories()).toEqual([]);
    await waitFor(() => expect(result.current.factories.data).toEqual([]));
  });

  it('rejects flat/legacy records when loading factories', () => {
    localStorage.setItem(
      'mastracode-factories',
      JSON.stringify([
        {
          id: 'flat-legacy',
          name: 'Legacy',
          path: '/repo/legacy',
          source: 'local',
          createdAt: 1,
        },
      ]),
    );

    expect(loadFactories()).toEqual([]);
  });

  it('creates a GitHub factory with a browser id distinct from githubProjectId and de-duplicates by repository id', async () => {
    let connected = false;
    server.use(
      http.get(`${ORIGIN}/web/github/repositories`, () =>
        HttpResponse.json(connected ? [githubRepositoryPayload] : []),
      ),
      http.post(`${ORIGIN}/web/github/repositories`, async () => {
        connected = true;
        return HttpResponse.json({ repository: githubRepositoryPayload });
      }),
    );

    const { result, client } = renderHookWithProviders(() => {
      const factories = useFactoriesQuery();
      const createGithub = useCreateGithubFactoryMutation();
      return { factories, createGithub };
    });

    let first: Factory | undefined;
    const repo = {
      id: 1,
      fullName: 'acme/mastra',
      name: 'mastra',
      owner: 'acme',
      private: false,
      defaultBranch: 'main',
      installationId: 9,
    };

    await act(async () => {
      first = await result.current.createGithub.mutateAsync(repo);
    });
    await waitForMutationsIdle(client);

    expect(first).toBeDefined();
    expect(first!.id).not.toBe('github-project-1');
    if (first!.binding.kind !== 'github') throw new Error('expected github binding');
    expect(first!.resourceId).toBe('github-project-1');
    expect(first!.binding.githubProjectId).toBe('github-project-1');
    expect(first!.binding.worktrees).toEqual([]);
    expect(first).not.toHaveProperty('path');
    expect(first).not.toHaveProperty('source');
    expect(first).not.toHaveProperty('githubProjectId');

    let second: Factory | undefined;
    await act(async () => {
      second = await result.current.createGithub.mutateAsync(repo);
    });
    await waitForMutationsIdle(client);

    expect(second!.id).toBe(first!.id);
    expect(loadFactories()).toHaveLength(1);
  });

  it('keeps active factory selection across reloads when stored under the new key', async () => {
    saveFactories([localFactory]);
    saveActiveFactoryId(localFactory.id);

    const { result } = renderHookWithProviders(() => useActiveFactory());
    await waitFor(() => expect(result.current.activeFactory?.id).toBe('factory-local'));
    expect(loadActiveFactoryId()).toBe('factory-local');
  });

  it('does not clear a persisted backend selection when repository hydration fails', async () => {
    saveActiveFactoryId('factory-gh');
    server.use(http.get(`${ORIGIN}/web/github/repositories`, () => new HttpResponse(null, { status: 503 })));

    const { result } = renderHookWithProviders(() => useActiveFactory());

    await waitFor(() => expect(result.current.factoriesPending).toBe(false));
    expect(result.current.activeFactory).toBeNull();
    expect(loadActiveFactoryId()).toBe('factory-gh');
  });
});
