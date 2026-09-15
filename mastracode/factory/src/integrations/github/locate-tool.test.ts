import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { createFactoryLocateTool, locateAcrossFactories } from './locate-tool.js';
import type { LocateDeps } from './locate-tool.js';

function makeDeps({
  search = vi.fn(async () => []),
  pathExists = vi.fn(async () => ({ exists: false })),
}: { search?: LocateDeps['searchFor'] extends (id: string) => infer S ? S['search'] : never; pathExists?: any } = {}) {
  const projects = {
    list: vi.fn(async () => [
      { id: 'fp-current', name: 'Current' },
      { id: 'fp-web', name: 'Web' },
      { id: 'fp-api', name: 'API' },
    ]),
  };
  const sourceControl = {
    installations: { list: vi.fn(async () => [{ id: 'inst-1', externalId: '100' }]) },
    connections: {
      list: vi.fn(async ({ factoryProjectId }: { factoryProjectId: string }) =>
        factoryProjectId === 'fp-current' ? [] : [{ id: `conn-${factoryProjectId}`, installationId: 'inst-1' }],
      ),
    },
    projectRepositories: {
      list: vi.fn(async ({ connectionId }: { connectionId: string }) => [
        { id: `pr-${connectionId}`, repositoryId: `repo-${connectionId}` },
      ]),
    },
    repositories: {
      get: vi.fn(async ({ id }: { id: string }) => ({
        id,
        slug: id === 'repo-conn-fp-web' ? 'acme/web' : 'acme/api',
      })),
    },
  };
  const searchFor = vi.fn(() => ({ search, pathExists }));
  return {
    deps: { projects, sourceControl, searchFor } as unknown as LocateDeps,
    search,
    pathExists,
    searchFor,
    sourceControl,
  };
}

describe('locateAcrossFactories', () => {
  it('groups code-search hits by the factory that owns the repository, excluding the current factory', async () => {
    const search = vi.fn(async () => [
      { repository: 'acme/web', path: 'src/Header.tsx', url: 'https://github.com/acme/web/blob/main/src/Header.tsx' },
      { repository: 'acme/web', path: 'src/Header.tsx', url: 'dup' },
      { repository: 'acme/other', path: 'x', url: 'y' },
    ]);
    const { deps } = makeDeps({ search });

    const result = await locateAcrossFactories(deps, {
      orgId: 'org-1',
      currentFactoryProjectId: 'fp-current',
      query: 'Header',
    });

    expect(result).toEqual({
      current: 'fp-current',
      factories: [
        {
          factoryProjectId: 'fp-web',
          name: 'Web',
          repositories: [
            {
              slug: 'acme/web',
              searchable: true,
              matches: [{ path: 'src/Header.tsx', url: 'https://github.com/acme/web/blob/main/src/Header.tsx' }],
            },
          ],
        },
      ],
    });
    expect(search).toHaveBeenCalledWith({ q: 'Header repo:acme/web repo:acme/api', perPage: 30 });
  });

  it('probes exact paths in every candidate repository', async () => {
    const pathExists = vi.fn(async ({ slug }: { slug: string }) =>
      slug === 'acme/api'
        ? { exists: true, url: 'https://github.com/acme/api/blob/main/src/routes.ts' }
        : { exists: false },
    );
    const { deps } = makeDeps({ pathExists });

    const result = await locateAcrossFactories(deps, {
      orgId: 'org-1',
      currentFactoryProjectId: 'fp-current',
      query: 'routes',
      paths: ['src/routes.ts'],
    });

    expect(result.factories).toEqual([
      {
        factoryProjectId: 'fp-api',
        name: 'API',
        repositories: [
          {
            slug: 'acme/api',
            searchable: true,
            matches: [{ path: 'src/routes.ts', url: 'https://github.com/acme/api/blob/main/src/routes.ts' }],
          },
        ],
      },
    ]);
  });

  it('reports repositories whose search failed as unsearchable instead of dropping them', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const search = vi.fn(async () => {
      throw Object.assign(new Error('forbidden'), { status: 403 });
    });
    const { deps } = makeDeps({ search });

    const result = await locateAcrossFactories(deps, {
      orgId: 'org-1',
      currentFactoryProjectId: 'fp-current',
      query: 'Header',
    });

    expect(result.factories.map(factory => factory.repositories[0])).toEqual([
      { slug: 'acme/web', searchable: false, matches: [] },
      { slug: 'acme/api', searchable: false, matches: [] },
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('returns no factories when nothing matches', async () => {
    const { deps } = makeDeps();
    const result = await locateAcrossFactories(deps, {
      orgId: 'org-1',
      currentFactoryProjectId: 'fp-current',
      query: 'nothing',
    });
    expect(result.factories).toEqual([]);
  });
});

describe('createFactoryLocateTool', () => {
  function contextFor({ orgId, factoryProjectId }: { orgId?: string; factoryProjectId?: string }) {
    const requestContext = new RequestContext();
    if (orgId) requestContext.set('user', { id: 'user-1', organizationId: orgId });
    requestContext.set('controller', { getState: () => ({ factoryProjectId }) });
    return requestContext;
  }

  it('is offered only to org sessions that belong to a factory', () => {
    const github = { getInstallationOctokit: vi.fn(), sourceControlStorage: {}, projectsStorage: {} } as any;
    expect(createFactoryLocateTool(contextFor({ orgId: 'org-1' }), github)).toEqual({});
    expect(createFactoryLocateTool(contextFor({ factoryProjectId: 'fp-1' }), github)).toEqual({});
    expect(
      Object.keys(createFactoryLocateTool(contextFor({ orgId: 'org-1', factoryProjectId: 'fp-1' }), github)),
    ).toEqual(['factory_locate']);
  });
});
