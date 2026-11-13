import { describe, expect, it, vi } from 'vitest';

import { LinkedGithubRepositories } from './linked-repositories.js';
import type { LinkedGithubRepositorySource } from './linked-repositories.js';

type Row = { installationExternalId: string; repositoryExternalId: string; orgIds: string[] };

function source(rows: Row[], options: { shared?: boolean; subscribe?: boolean } = {}) {
  const listeners = new Set<() => void>();
  const value = {
    rows,
    listConfiguredExternalKeys: vi.fn(async () =>
      value.rows.map(({ installationExternalId, repositoryExternalId }) => ({
        installationExternalId,
        repositoryExternalId,
      })),
    ),
    listByExternalRepository: vi.fn(async (args: { installationExternalId: string; repositoryExternalId: string }) =>
      (
        value.rows.find(
          row =>
            row.installationExternalId === args.installationExternalId &&
            row.repositoryExternalId === args.repositoryExternalId,
        )?.orgIds ?? []
      ).map(orgId => ({ orgId, factoryProjectId: `proj-${orgId}` }) as never),
    ),
    ...(options.subscribe === false
      ? {}
      : {
          onLinkedRepositoriesChanged: (listener: () => void) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
          },
        }),
    linkedRepositoryChangesShared: () => options.shared ?? true,
    change: () => {
      for (const listener of listeners) listener();
    },
    listeners,
  };
  return value satisfies LinkedGithubRepositorySource;
}

describe('LinkedGithubRepositories', () => {
  it('indexes linked repositories by id, with every installation and org that links them', async () => {
    const links = new LinkedGithubRepositories(() =>
      source([
        { installationExternalId: '7', repositoryExternalId: '101', orgIds: ['org-1', 'org-2'] },
        { installationExternalId: '8', repositoryExternalId: '101', orgIds: ['org-3'] },
        { installationExternalId: '7', repositoryExternalId: '102', orgIds: ['org-1'] },
      ]),
    );
    await expect(links.forRepository(101)).resolves.toEqual([
      { installationId: 7, orgIds: ['org-1', 'org-2'] },
      { installationId: 8, orgIds: ['org-3'] },
    ]);
    await expect(links.forRepository(102)).resolves.toEqual([{ installationId: 7, orgIds: ['org-1'] }]);
    await expect(links.forRepository(999)).resolves.toEqual([]);
  });

  it('skips keys with non-numeric ids and keys no project links', async () => {
    const links = new LinkedGithubRepositories(() =>
      source([
        { installationExternalId: 'abc', repositoryExternalId: '101', orgIds: ['org-1'] },
        { installationExternalId: '7', repositoryExternalId: 'x', orgIds: ['org-1'] },
        { installationExternalId: '7', repositoryExternalId: '103', orgIds: [] },
      ]),
    );
    await expect(links.forRepository(101)).resolves.toEqual([]);
    await expect(links.forRepository(103)).resolves.toEqual([]);
  });

  it('reads storage once while link changes reach this replica, and again after a change', async () => {
    const storage = source([{ installationExternalId: '7', repositoryExternalId: '101', orgIds: ['org-1'] }]);
    const links = new LinkedGithubRepositories(() => storage);

    await links.forRepository(101);
    await links.forRepository(101);
    expect(storage.listConfiguredExternalKeys).toHaveBeenCalledTimes(1);

    storage.rows = [];
    storage.change();
    await expect(links.forRepository(101)).resolves.toEqual([]);
    expect(storage.listConfiguredExternalKeys).toHaveBeenCalledTimes(2);
  });

  it('re-reads after a short time while changes on other replicas cannot reach this one', async () => {
    let now = 0;
    const storage = source([{ installationExternalId: '7', repositoryExternalId: '101', orgIds: ['org-1'] }], {
      shared: false,
    });
    const links = new LinkedGithubRepositories(() => storage, { unsharedTtlMs: 1_000, now: () => now });

    await links.forRepository(101);
    now = 999;
    await links.forRepository(101);
    expect(storage.listConfiguredExternalKeys).toHaveBeenCalledTimes(1);

    storage.rows.push({ installationExternalId: '7', repositoryExternalId: '102', orgIds: ['org-2'] });
    now = 1_000;
    await expect(links.forRepository(102)).resolves.toEqual([{ installationId: 7, orgIds: ['org-2'] }]);
    expect(storage.listConfiguredExternalKeys).toHaveBeenCalledTimes(2);
  });

  it('re-reads after a short time when it cannot subscribe to changes at all', async () => {
    let now = 0;
    const storage = source([], { subscribe: false });
    const links = new LinkedGithubRepositories(() => storage, { unsharedTtlMs: 1_000, now: () => now });
    await links.forRepository(101);
    now = 1_000;
    await links.forRepository(101);
    expect(storage.listConfiguredExternalKeys).toHaveBeenCalledTimes(2);
  });

  it('reads again after a failed read instead of caching the failure', async () => {
    const storage = source([{ installationExternalId: '7', repositoryExternalId: '101', orgIds: ['org-1'] }]);
    storage.listConfiguredExternalKeys.mockRejectedValueOnce(new Error('storage down'));
    const links = new LinkedGithubRepositories(() => storage);

    await expect(links.forRepository(101)).rejects.toThrow('storage down');
    await expect(links.forRepository(101)).resolves.toEqual([{ installationId: 7, orgIds: ['org-1'] }]);
  });

  it('stops listening for changes once closed', async () => {
    const storage = source([]);
    const links = new LinkedGithubRepositories(() => storage);
    await links.forRepository(101);
    expect(storage.listeners.size).toBe(1);
    links.close();
    expect(storage.listeners.size).toBe(0);
  });
});
