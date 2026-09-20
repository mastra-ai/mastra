import type { FactoryStorage } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import type { FactoryProject } from '../storage/domains/projects/base.js';
import { factoryProjectScopes, withProjectScopedIntegrations } from './project-scopes.js';

function fakeStorageWithProjects(projects: Array<Pick<FactoryProject, 'id'>>) {
  const ensureReady = vi.fn(async () => {});
  const listAll = vi.fn(async () => projects);
  const storage = {
    getDomain: vi.fn((name: string) => {
      if (name !== 'projects') throw new Error(`Factory storage domain '${name}' is not registered`);
      return { ensureReady, listAll };
    }),
  } as unknown as FactoryStorage;
  return { storage, ensureReady, listAll };
}

describe('factoryProjectScopes', () => {
  it('resolves one resource scope per Factory project', async () => {
    const { storage, ensureReady } = fakeStorageWithProjects([{ id: 'p1' }, { id: 'p2' }]);
    const scopes = factoryProjectScopes(storage);
    await expect(scopes()).resolves.toEqual(['resource:p1', 'resource:p2']);
    expect(ensureReady).toHaveBeenCalled();
  });

  it('resolves an empty list when no projects exist', async () => {
    const { storage } = fakeStorageWithProjects([]);
    await expect(factoryProjectScopes(storage)()).resolves.toEqual([]);
  });

  it('re-enumerates the live inventory on every call', async () => {
    const { storage, listAll } = fakeStorageWithProjects([{ id: 'p1' }]);
    const scopes = factoryProjectScopes(storage);
    await scopes();
    listAll.mockResolvedValueOnce([{ id: 'p1' }, { id: 'p3' }]);
    await expect(scopes()).resolves.toEqual(['resource:p1', 'resource:p3']);
  });

  it('throws when the projects domain is not registered yet, leaving retry to the importer runner', async () => {
    const storage = {
      getDomain: () => {
        throw new Error("Factory storage domain 'projects' is not registered");
      },
    } as unknown as FactoryStorage;
    await expect(factoryProjectScopes(storage)()).rejects.toThrow(/not registered/);
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
    await expect(integrations.notion!.scopes!()).resolves.toEqual(['resource:p1']);
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
