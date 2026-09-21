import type { ImporterScopesContext } from '@mastra/connect';
import type { Knowledge } from '@mastra/core/knowledge';
import type { FactoryStorage } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import type { KnowledgeImporterRoutingRecord } from '../storage/domains/importer-routing/base.js';
import type { FactoryProject } from '../storage/domains/projects/base.js';
import { connectSourceScopeAddress, factoryProjectScopes, withProjectScopedIntegrations } from './project-scopes.js';

function scopesContext(connectionId = 'conn-1', integrationId = 'notion'): ImporterScopesContext {
  return { connection: { id: connectionId, integrationId, status: 'active' } as never };
}

type ProjectSeed = Pick<FactoryProject, 'id'> & Partial<Pick<FactoryProject, 'orgId' | 'name'>>;

function seedProject(seed: ProjectSeed): Pick<FactoryProject, 'id' | 'orgId' | 'name'> {
  return { id: seed.id, orgId: seed.orgId ?? 'org-1', name: seed.name ?? seed.id };
}

function fakeStorage(input: {
  projects: ProjectSeed[];
  routing?: Map<string, Pick<KnowledgeImporterRoutingRecord, 'mode' | 'projectIds'>>;
}) {
  const ensureReady = vi.fn(async () => {});
  const listAll = vi.fn(async () => input.projects.map(seedProject));
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

function fakeStorageWithProjects(projects: ProjectSeed[]) {
  return fakeStorage({ projects });
}

/**
 * Knowledge stub tracking materialized scope addresses. `existing` seeds
 * addresses that already resolve — materialization must skip those rungs.
 */
function fakeKnowledge(existing: string[] = []) {
  const materialized: Array<{ address: string; name?: string; parentAddresses?: string[] }> = [];
  const resolved = new Set(existing);
  const knowledge = {
    resolveScopeAddress: vi.fn(async (address: string) =>
      resolved.has(address) ? { scopeNodeId: `id-${address}` } : null,
    ),
    materializeScope: vi.fn(async (input: { address: string; name?: string; parentAddresses?: string[] }) => {
      materialized.push(input);
      resolved.add(input.address);
      return {};
    }),
  } as unknown as Knowledge;
  return { knowledge, materialized };
}

describe('factoryProjectScopes', () => {
  it('resolves one per-source sub-scope per Factory project', async () => {
    const { storage, ensureReady } = fakeStorageWithProjects([{ id: 'p1' }, { id: 'p2' }]);
    const scopes = factoryProjectScopes(storage);
    await expect(scopes(scopesContext())).resolves.toEqual([
      'resource:p1:connect:notion',
      'resource:p2:connect:notion',
    ]);
    expect(ensureReady).toHaveBeenCalled();
  });

  it('derives the sub-scope from the resolving connection integration id', async () => {
    const { storage } = fakeStorageWithProjects([{ id: 'p1' }]);
    const scopes = factoryProjectScopes(storage);
    await expect(scopes(scopesContext('conn-ff', 'fireflies'))).resolves.toEqual(['resource:p1:connect:fireflies']);
  });

  it('resolves an empty list when no projects exist', async () => {
    const { storage } = fakeStorageWithProjects([]);
    await expect(factoryProjectScopes(storage)(scopesContext())).resolves.toEqual([]);
  });

  it('re-enumerates the live inventory on every call', async () => {
    const { storage, listAll } = fakeStorageWithProjects([{ id: 'p1' }]);
    const scopes = factoryProjectScopes(storage);
    await scopes(scopesContext());
    listAll.mockResolvedValueOnce([seedProject({ id: 'p1' }), seedProject({ id: 'p3' })] as never);
    await expect(scopes(scopesContext())).resolves.toEqual([
      'resource:p1:connect:notion',
      'resource:p3:connect:notion',
    ]);
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

  describe('scope materialization', () => {
    it('materializes the org → resource → source chain for a project nobody has visited', async () => {
      const { storage } = fakeStorageWithProjects([{ id: 'p1', orgId: 'org-9' }]);
      const { knowledge, materialized } = fakeKnowledge();
      const scopes = factoryProjectScopes(storage, { knowledge: () => knowledge });
      await expect(scopes(scopesContext())).resolves.toEqual(['resource:p1:connect:notion']);
      expect(materialized.map(scope => scope.address)).toEqual([
        'org:org-9',
        'resource:p1',
        'resource:p1:connect:notion',
      ]);
      // The source rung carries the provider display name and hangs off the
      // project scope — that's what the graph renders as a separate node.
      expect(materialized[2]).toMatchObject({ name: 'Notion', parentAddresses: ['resource:p1'] });
      // Org and resource rungs mirror the built-in shapes (no name override),
      // so they coalesce with the knowledge routes' own materialization pass.
      expect(materialized[0]!.name).toBeUndefined();
      expect(materialized[1]!.name).toBeUndefined();
    });

    it('only materializes the missing rungs when the project scopes already exist', async () => {
      const { storage } = fakeStorageWithProjects([{ id: 'p1', orgId: 'org-9' }]);
      const { knowledge, materialized } = fakeKnowledge(['org:org-9', 'resource:p1']);
      await factoryProjectScopes(storage, { knowledge: () => knowledge })(scopesContext());
      expect(materialized.map(scope => scope.address)).toEqual(['resource:p1:connect:notion']);
    });

    it('materializes nothing on subsequent fires once the chain exists', async () => {
      const { storage } = fakeStorageWithProjects([{ id: 'p1' }]);
      const { knowledge, materialized } = fakeKnowledge();
      const scopes = factoryProjectScopes(storage, { knowledge: () => knowledge });
      await scopes(scopesContext());
      const afterFirst = materialized.length;
      await scopes(scopesContext());
      expect(materialized.length).toBe(afterFirst);
    });

    it('skips materialization when the knowledge thunk is empty, still resolving addresses', async () => {
      const { storage } = fakeStorageWithProjects([{ id: 'p1' }]);
      const scopes = factoryProjectScopes(storage, { knowledge: () => undefined });
      await expect(scopes(scopesContext())).resolves.toEqual(['resource:p1:connect:notion']);
    });

    it('propagates materialization failures so the runner keeps the last-good binding set', async () => {
      const { storage } = fakeStorageWithProjects([{ id: 'p1' }]);
      const knowledge = {
        resolveScopeAddress: vi.fn(async () => null),
        materializeScope: vi.fn(async () => {
          throw new Error('storage blip');
        }),
      } as unknown as Knowledge;
      await expect(factoryProjectScopes(storage, { knowledge: () => knowledge })(scopesContext())).rejects.toThrow(
        'storage blip',
      );
    });
  });

  describe('per-connection routing', () => {
    it('restricts a selected-mode connection to its chosen projects, intersected with the live inventory', async () => {
      const { storage, routingGet } = fakeStorage({
        projects: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
        routing: new Map([['conn-notion', { mode: 'selected' as const, projectIds: ['p2', 'deleted-project'] }]]),
      });
      const scopes = factoryProjectScopes(storage);
      await expect(scopes(scopesContext('conn-notion'))).resolves.toEqual(['resource:p2:connect:notion']);
      expect(routingGet).toHaveBeenCalledWith('conn-notion');
    });

    it('resolves every project for a connection with mode all or no routing row', async () => {
      const { storage } = fakeStorage({
        projects: [{ id: 'p1' }, { id: 'p2' }],
        routing: new Map([['conn-all', { mode: 'all' as const, projectIds: [] }]]),
      });
      const scopes = factoryProjectScopes(storage);
      await expect(scopes(scopesContext('conn-all'))).resolves.toEqual([
        'resource:p1:connect:notion',
        'resource:p2:connect:notion',
      ]);
      await expect(scopes(scopesContext('conn-unrouted'))).resolves.toEqual([
        'resource:p1:connect:notion',
        'resource:p2:connect:notion',
      ]);
    });

    it('resolves zero scopes for a connection routed to no projects — connected but syncing nowhere', async () => {
      const { storage } = fakeStorage({
        projects: [{ id: 'p1' }, { id: 'p2' }],
        routing: new Map([['conn-idle', { mode: 'selected' as const, projectIds: [] }]]),
      });
      const scopes = factoryProjectScopes(storage);
      await expect(scopes(scopesContext('conn-idle'))).resolves.toEqual([]);
    });

    it('materializes only the routed projects, not the whole inventory', async () => {
      const { storage } = fakeStorage({
        projects: [{ id: 'p1' }, { id: 'p2' }],
        routing: new Map([['conn-a', { mode: 'selected' as const, projectIds: ['p1'] }]]),
      });
      const { knowledge, materialized } = fakeKnowledge(['org:org-1', 'resource:p1', 'resource:p2']);
      await factoryProjectScopes(storage, { knowledge: () => knowledge })(scopesContext('conn-a'));
      expect(materialized.map(scope => scope.address)).toEqual(['resource:p1:connect:notion']);
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
      await expect(scopes(scopesContext('conn-a'))).resolves.toEqual(['resource:p1:connect:notion']);
      await expect(scopes(scopesContext('conn-b'))).resolves.toEqual(['resource:p2:connect:notion']);
    });

    it('ignores routing entirely when the routing domain is not registered', async () => {
      const { storage } = fakeStorageWithProjects([{ id: 'p1' }]);
      await expect(factoryProjectScopes(storage)(scopesContext('conn-any'))).resolves.toEqual([
        'resource:p1:connect:notion',
      ]);
    });
  });
});

describe('connectSourceScopeAddress', () => {
  it('builds the per-source sub-scope address', () => {
    expect(connectSourceScopeAddress('p1', 'linear')).toBe('resource:p1:connect:linear');
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
    // Document-shaped sources own their nodes (Linear Documents and Zendesk
    // Help Center articles included); ticket/transcript sources only upsert.
    for (const id of ['notion', 'confluence', 'linear', 'zendesk']) {
      expect(integrations[id]).toMatchObject({ access: { 'resource:$projectId:connect:$sourceId': 'owner' } });
    }
    for (const id of ['jira', 'fireflies']) {
      expect(integrations[id]).toMatchObject({ access: { 'resource:$projectId:connect:$sourceId': 'edit' } });
    }
    await expect(integrations.notion!.scopes!(scopesContext())).resolves.toEqual(['resource:p1:connect:notion']);
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
