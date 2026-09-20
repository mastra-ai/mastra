import type { ImporterScopesContext } from '@mastra/connect';
import type { FactoryStorage } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import type { KnowledgeImporterRoutingRecord } from '../storage/domains/importer-routing/base.js';
import type { FactoryProject } from '../storage/domains/projects/base.js';
import { factoryProjectScopes, withProjectScopedIntegrations } from './project-scopes.js';

function scopesContext(connectionId = 'conn-1'): ImporterScopesContext {
  return { connection: { id: connectionId, integrationId: 'notion', status: 'active' } as never };
}

function fakeStorage(input: {
  projects: Array<Pick<FactoryProject, 'id'>>;
  routing?: Map<string, Pick<KnowledgeImporterRoutingRecord, 'mode' | 'projectIds'>>;
}) {
  const ensureReady = vi.fn(async () => {});
  const listAll = vi.fn(async () => input.projects);
  const routingGet = vi.fn(async (connectionId: string) => input.routing?.get(connectionId) ?? null);
  const storage = {
    hasDomain: vi.fn((name: string) => name === 'projects' || (name === 'importer-routing' && Boolean(input.routing))),
    getDomain: vi.fn((name: string) => {
      if (name === 'projects') return { ensureReady, listAll };
      if (name === 'importer-routing' && input.routing) return { ensureReady, get: routingGet };
      throw new Error(`Factory storage domain '${name}' is not registered`);
    }),
  } as unknown as FactoryStorage;
  return { storage, ensureReady, listAll, routingGet };
}

function fakeStorageWithProjects(projects: Array<Pick<FactoryProject, 'id'>>) {
  return fakeStorage({ projects });
}

describe('factoryProjectScopes', () => {
  it('resolves one resource scope per Factory project', async () => {
    const { storage, ensureReady } = fakeStorageWithProjects([{ id: 'p1' }, { id: 'p2' }]);
    const scopes = factoryProjectScopes(storage);
    await expect(scopes(scopesContext())).resolves.toEqual(['resource:p1', 'resource:p2']);
    expect(ensureReady).toHaveBeenCalled();
  });

  it('resolves an empty list when no projects exist', async () => {
    const { storage } = fakeStorageWithProjects([]);
    await expect(factoryProjectScopes(storage)(scopesContext())).resolves.toEqual([]);
  });

  it('re-enumerates the live inventory on every call', async () => {
    const { storage, listAll } = fakeStorageWithProjects([{ id: 'p1' }]);
    const scopes = factoryProjectScopes(storage);
    await scopes(scopesContext());
    listAll.mockResolvedValueOnce([{ id: 'p1' }, { id: 'p3' }]);
    await expect(scopes(scopesContext())).resolves.toEqual(['resource:p1', 'resource:p3']);
  });

  it('throws when the projects domain is not registered yet, leaving retry to the importer runner', async () => {
    const storage = {
      hasDomain: () => false,
      getDomain: () => {
        throw new Error("Factory storage domain 'projects' is not registered");
      },
    } as unknown as FactoryStorage;
    await expect(factoryProjectScopes(storage)(scopesContext())).rejects.toThrow(/not registered/);
  });

  describe('per-connection routing', () => {
    it('restricts a selected-mode connection to its chosen projects, intersected with the live inventory', async () => {
      const { storage, routingGet } = fakeStorage({
        projects: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
        routing: new Map([['conn-notion', { mode: 'selected' as const, projectIds: ['p2', 'deleted-project'] }]]),
      });
      const scopes = factoryProjectScopes(storage);
      await expect(scopes(scopesContext('conn-notion'))).resolves.toEqual(['resource:p2']);
      expect(routingGet).toHaveBeenCalledWith('conn-notion');
    });

    it('resolves every project for a connection with mode all or no routing row', async () => {
      const { storage } = fakeStorage({
        projects: [{ id: 'p1' }, { id: 'p2' }],
        routing: new Map([['conn-all', { mode: 'all' as const, projectIds: [] }]]),
      });
      const scopes = factoryProjectScopes(storage);
      await expect(scopes(scopesContext('conn-all'))).resolves.toEqual(['resource:p1', 'resource:p2']);
      await expect(scopes(scopesContext('conn-unrouted'))).resolves.toEqual(['resource:p1', 'resource:p2']);
    });

    it('routes different connections of the same provider independently', async () => {
      const { storage } = fakeStorage({
        projects: [{ id: 'p1' }, { id: 'p2' }],
        routing: new Map([
          ['conn-a', { mode: 'selected' as const, projectIds: ['p1'] }],
          ['conn-b', { mode: 'selected' as const, projectIds: ['p2'] }],
        ]),
      });
      const scopes = factoryProjectScopes(storage);
      await expect(scopes(scopesContext('conn-a'))).resolves.toEqual(['resource:p1']);
      await expect(scopes(scopesContext('conn-b'))).resolves.toEqual(['resource:p2']);
    });

    it('ignores routing entirely when the routing domain is not registered', async () => {
      const { storage } = fakeStorageWithProjects([{ id: 'p1' }]);
      await expect(factoryProjectScopes(storage)(scopesContext('conn-any'))).resolves.toEqual(['resource:p1']);
    });
  });
});

describe('withProjectScopedIntegrations', () => {
  it('defaults every catalogue provider to a parameterized grant plus the project scopes resolver', async () => {
    const { storage } = fakeStorageWithProjects([{ id: 'p1' }]);
    const options = withProjectScopedIntegrations(undefined, storage);
    const integrations = options.integrations!;
    expect(Object.keys(integrations).sort()).toEqual([
      'confluence',
      'fireflies',
      'jira',
      'linear',
      'notion',
      'zendesk',
    ]);
    expect(integrations.notion).toMatchObject({ access: { 'resource:$projectId': 'owner' } });
    expect(integrations.confluence).toMatchObject({ access: { 'resource:$projectId': 'owner' } });
    for (const id of ['jira', 'linear', 'zendesk', 'fireflies']) {
      expect(integrations[id]).toMatchObject({ access: { 'resource:$projectId': 'edit' } });
    }
    await expect(integrations.notion!.scopes!(scopesContext())).resolves.toEqual(['resource:p1']);
  });

  it('preserves other importer options while filling in default integrations', () => {
    const { storage } = fakeStorageWithProjects([]);
    const options = withProjectScopedIntegrations({ ttlMs: 12345 }, storage);
    expect(options.ttlMs).toBe(12345);
    expect(options.integrations).toBeDefined();
  });

  it('uses host-supplied integrations verbatim — the host owns the destination topology', () => {
    const { storage } = fakeStorageWithProjects([{ id: 'p1' }]);
    const hostOptions = { integrations: { notion: { scope: 'org:acme' } } };
    expect(withProjectScopedIntegrations(hostOptions, storage)).toBe(hostOptions);
  });
});
