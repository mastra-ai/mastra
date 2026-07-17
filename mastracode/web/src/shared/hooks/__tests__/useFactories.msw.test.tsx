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
    server.use(
      http.post(`${ORIGIN}/web/github/repositories`, async () => {
        return HttpResponse.json({
          repository: {
            id: 'github-project-1',
            name: 'acme/mastra',
            source: 'github',
            githubProjectId: 'github-project-1',
          },
        });
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
});
