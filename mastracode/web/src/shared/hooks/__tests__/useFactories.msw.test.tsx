import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, waitForMutationsIdle, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import type { LocalFactory, ServerFactory } from '../../../web/ui/domains/workspaces/services/factories';
import {
  loadActiveFactoryId,
  loadFactories,
  saveActiveFactoryId,
  saveFactories,
} from '../../../web/ui/domains/workspaces/services/factories';
import { useActiveFactory } from '../useActiveFactory';
import {
  useAddFactoryMutation,
  useCreateFactoryMutation,
  useFactoriesQuery,
  useLinkRepositoryMutation,
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

const serverFactory: ServerFactory = {
  id: 'factory-server',
  name: 'Acme Product',
  createdAt: 2,
  binding: {
    kind: 'factory',
    factoryProjectId: 'fp-1',
    repositories: [],
  },
};

const factoryProjectPayload = { id: 'fp-1', name: 'Acme Product' };

const projectRepositoryPayload = {
  id: 'pr-1',
  branch: 'main',
  sandboxWorkdir: '/workspace/acme/mastra',
  repository: { slug: 'acme/mastra', defaultBranch: 'main' },
};

/** MSW handlers for the Factory-projects list walk used by repository hydration. */
function factoryProjectListHandlers(getLinks: () => Array<typeof projectRepositoryPayload>) {
  return [
    http.get(`${ORIGIN}/web/factory/projects`, () => HttpResponse.json({ projects: [factoryProjectPayload] })),
    http.get(`${ORIGIN}/web/factory/projects/${factoryProjectPayload.id}/source-control-connections`, () =>
      HttpResponse.json({ connections: [{ id: 'conn-1', installationId: 'inst-1', repositories: getLinks() }] }),
    ),
  ];
}

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

  it('hydrates server factories from the Factory project list while preserving browser identity', async () => {
    saveFactories([
      localFactory,
      {
        ...serverFactory,
        binding: {
          ...serverFactory.binding,
          repositories: [
            {
              projectRepositoryId: 'pr-1',
              slug: 'acme/mastra',
              sandboxId: 'sbx-cached',
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
          ],
        },
      },
    ]);
    server.use(...factoryProjectListHandlers(() => [projectRepositoryPayload]));

    const { result } = renderHookWithProviders(() => useFactoriesQuery());

    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.data).toEqual([
      localFactory,
      {
        id: 'factory-server',
        name: 'Acme Product',
        resourceId: undefined,
        createdAt: 2,
        binding: {
          kind: 'factory',
          factoryProjectId: 'fp-1',
          selectedRepositoryId: undefined,
          repositories: [
            {
              projectRepositoryId: 'pr-1',
              slug: 'acme/mastra',
              gitBranch: 'main',
              sandboxId: 'sbx-cached',
              sandboxWorkdir: '/workspace/acme/mastra',
              // Cached worktrees survive hydration; the stale selection is dropped.
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

  it('creates a named server-backed factory with zero repositories and a distinct browser id', async () => {
    server.use(
      http.post(`${ORIGIN}/web/factory/projects`, async ({ request }) => {
        expect(await request.json()).toEqual({ name: 'Acme Product' });
        return HttpResponse.json({ project: factoryProjectPayload });
      }),
    );

    const { result, client } = renderHookWithProviders(() => {
      const factories = useFactoriesQuery();
      const createFactory = useCreateFactoryMutation();
      return { factories, createFactory };
    });
    await waitFor(() => expect(result.current.factories.isFetching).toBe(false));

    let created: ServerFactory | undefined;
    await act(async () => {
      created = await result.current.createFactory.mutateAsync({ name: 'Acme Product' });
    });
    await waitForMutationsIdle(client);

    expect(created).toBeDefined();
    expect(created!.id).not.toBe('fp-1');
    expect(created!.binding).toEqual({ kind: 'factory', factoryProjectId: 'fp-1', repositories: [] });
    await waitFor(() => expect(result.current.factories.data.map(factory => factory.name)).toEqual(['Acme Product']));

    // Re-creating the same project keeps the existing browser factory.
    let second: ServerFactory | undefined;
    await act(async () => {
      second = await result.current.createFactory.mutateAsync({ name: 'Acme Product' });
    });
    await waitForMutationsIdle(client);
    expect(second!.id).toBe(created!.id);
    expect(loadFactories()).toHaveLength(1);
  });

  it('links a GitHub repository to a factory and hydrates it into the repository list', async () => {
    saveFactories([serverFactory]);
    let linked = false;
    server.use(
      ...factoryProjectListHandlers(() => (linked ? [projectRepositoryPayload] : [])),
      http.post(`${ORIGIN}/web/factory/projects/${factoryProjectPayload.id}/source-control-connections`, () =>
        HttpResponse.json({ connection: { id: 'conn-1' } }),
      ),
      http.post(
        `${ORIGIN}/web/factory/projects/${factoryProjectPayload.id}/source-control-connections/conn-1/repositories`,
        async ({ request }) => {
          expect(await request.json()).toMatchObject({ repositoryId: 'repo-1', branch: 'main' });
          linked = true;
          return HttpResponse.json({ projectRepository: projectRepositoryPayload });
        },
      ),
    );

    const { result, client } = renderHookWithProviders(() => {
      const factories = useFactoriesQuery();
      const linkRepository = useLinkRepositoryMutation();
      return { factories, linkRepository };
    });
    await waitFor(() => expect(result.current.factories.isFetching).toBe(false));

    await act(async () => {
      await result.current.linkRepository.mutateAsync({
        factoryProjectId: 'fp-1',
        repo: {
          id: 1,
          fullName: 'acme/mastra',
          name: 'mastra',
          owner: 'acme',
          private: false,
          defaultBranch: 'main',
          installationId: 9,
          installationStorageId: 'inst-9',
          repositoryStorageId: 'repo-1',
          sandboxProvider: 'local',
          sandboxWorkdir: '/workspace/acme/mastra',
        },
      });
    });
    await waitForMutationsIdle(client);

    await waitFor(() => {
      const factory = result.current.factories.data.find(candidate => candidate.id === 'factory-server');
      expect(factory?.binding.kind === 'factory' && factory.binding.repositories).toEqual([
        {
          projectRepositoryId: 'pr-1',
          slug: 'acme/mastra',
          gitBranch: 'main',
          sandboxId: undefined,
          sandboxWorkdir: '/workspace/acme/mastra',
          worktrees: [],
          selectedWorktreePath: undefined,
        },
      ]);
    });
  });

  it('removes the active factory, clears active id, and refreshes factory query consumers', async () => {
    saveFactories([localFactory, { ...serverFactory, resourceId: 'resource-server' }]);
    saveActiveFactoryId(localFactory.id);
    server.use(...factoryProjectListHandlers(() => []));

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

    expect(loadFactories().map(factory => factory.id)).toEqual(['factory-server']);
    expect(loadActiveFactoryId()).toBeNull();
    await waitFor(() => expect(result.current.factories.data.map(factory => factory.id)).toEqual(['factory-server']));
  });

  it('deletes the Factory project from the backend before removing its browser factory', async () => {
    saveFactories([serverFactory]);
    let connected = true;
    server.use(
      http.get(`${ORIGIN}/web/factory/projects`, () =>
        HttpResponse.json({ projects: connected ? [factoryProjectPayload] : [] }),
      ),
      http.get(`${ORIGIN}/web/factory/projects/${factoryProjectPayload.id}/source-control-connections`, () =>
        HttpResponse.json({ connections: [] }),
      ),
      http.delete(`${ORIGIN}/web/factory/projects/${factoryProjectPayload.id}`, () => {
        expect(loadFactories().some(factory => factory.id === serverFactory.id)).toBe(true);
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
      await result.current.removeFactory.mutateAsync(serverFactory.id);
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
        {
          id: 'prerelease-github',
          name: 'acme/mastra',
          createdAt: 2,
          binding: { kind: 'github', githubProjectId: 'github-project-1', worktrees: [] },
        },
      ]),
    );

    expect(loadFactories()).toEqual([]);
  });

  it('keeps active factory selection across reloads when stored under the new key', async () => {
    saveFactories([localFactory]);
    saveActiveFactoryId(localFactory.id);

    const { result } = renderHookWithProviders(() => useActiveFactory());
    await waitFor(() => expect(result.current.activeFactory?.id).toBe('factory-local'));
    expect(loadActiveFactoryId()).toBe('factory-local');
  });

  it('does not clear a persisted backend selection when repository hydration fails', async () => {
    saveActiveFactoryId('factory-server');
    server.use(http.get(`${ORIGIN}/web/factory/projects`, () => new HttpResponse(null, { status: 503 })));

    const { result } = renderHookWithProviders(() => useActiveFactory());

    await waitFor(() => expect(result.current.factoriesPending).toBe(false));
    expect(result.current.activeFactory).toBeNull();
    expect(loadActiveFactoryId()).toBe('factory-server');
  });
});
