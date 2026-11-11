import { describe, expect, it, vi } from 'vitest';

import type { RepositoryAccess } from '../capabilities/version-control.js';
import { groupedRepositoryAccess } from './repository-access.js';

function versionControl(options: { grantGroups: boolean }) {
  const cache = new Map<string, RepositoryAccess>();
  const mints: string[][] = [];
  const access = (token: string, repositoryId: string): RepositoryAccess => ({
    cloneUrl: `https://github.com/acme/${repositoryId}.git`,
    authorization: { scheme: 'bearer', token },
  });
  return {
    mints,
    getRepositoriesAccess: vi.fn(async ({ repositoryIds }: { orgId: string; repositoryIds: string[] }) => {
      if (!options.grantGroups) return undefined;
      mints.push(repositoryIds);
      const token = `group-${mints.length}`;
      for (const id of repositoryIds) cache.set(id, access(token, id));
      return access(token, repositoryIds[0]!);
    }),
    getRepositoryAccess: vi.fn(async ({ repositoryId }: { orgId: string; repositoryId: string }) => {
      const cached = cache.get(repositoryId);
      if (cached) return cached;
      mints.push([repositoryId]);
      const minted = access(`repo-${repositoryId}`, repositoryId);
      cache.set(repositoryId, minted);
      return minted;
    }),
  };
}

const elevenRepositories = Array.from({ length: 11 }, (_, index) => `repo-${index}`);

describe('groupedRepositoryAccess', () => {
  it('mints eleven repositories as two tokens instead of eleven', async () => {
    const vc = versionControl({ grantGroups: true });
    const access = groupedRepositoryAccess(vc, 'org-1', elevenRepositories);

    const results = await Promise.all(elevenRepositories.map(id => access(id)));

    expect(vc.mints).toEqual([elevenRepositories.slice(0, 10), ['repo-10']]);
    expect(results[0]!.authorization?.token).toBe('group-1');
    expect(results[9]!.authorization?.token).toBe('group-1');
    expect(results[10]!.cloneUrl).toBe('https://github.com/acme/repo-10.git');
  });

  it("falls back to each repository's own token when the group can't be granted", async () => {
    const vc = versionControl({ grantGroups: false });
    const access = groupedRepositoryAccess(vc, 'org-1', ['a', 'b']);

    const result = await access('b');

    expect(result.authorization?.token).toBe('repo-b');
    expect(vc.mints).toEqual([['b']]);
  });

  it('still returns access when the group mint fails', async () => {
    const vc = versionControl({ grantGroups: true });
    vc.getRepositoriesAccess.mockRejectedValueOnce(new Error('rate limited'));
    const access = groupedRepositoryAccess(vc, 'org-1', ['a', 'b']);

    await expect(access('a')).resolves.toMatchObject({ authorization: { token: 'repo-a' } });
  });
});
