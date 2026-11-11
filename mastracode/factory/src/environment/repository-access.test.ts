import { describe, expect, it, vi } from 'vitest';

import type { RepositoryAccess } from '../capabilities/version-control.js';
import { groupedRepositoryAccess } from './repository-access.js';

function versionControl(options: { grantGroups: boolean }) {
  const mints: string[][] = [];
  const access = (token: string, repositoryId: string): RepositoryAccess => ({
    cloneUrl: `https://github.com/acme/${repositoryId}.git`,
    authorization: { scheme: 'bearer', token },
  });
  const groupCache = new Map<string, ReturnType<typeof mintGroup>>();
  const mintGroup = async (repositoryIds: string[]) => {
    mints.push(repositoryIds);
    const token = `group-${mints.length}`;
    return {
      ...access(token, repositoryIds[0]!),
      repositories: Object.fromEntries(repositoryIds.map(id => [id, access(token, id)])),
    };
  };
  return {
    mints,
    getRepositoriesAccess: vi.fn(async ({ repositoryIds }: { orgId: string; repositoryIds: string[] }) => {
      if (!options.grantGroups) return undefined;
      const key = repositoryIds.join(',');
      if (!groupCache.has(key)) groupCache.set(key, mintGroup(repositoryIds));
      return groupCache.get(key)!;
    }),
    getRepositoryAccess: vi.fn(async ({ repositoryId }: { orgId: string; repositoryId: string }) => {
      mints.push([repositoryId]);
      return access(`repo-${repositoryId}`, repositoryId);
    }),
  };
}

const elevenRepositories = Array.from({ length: 11 }, (_, index) => `repo-${index}`);

describe('groupedRepositoryAccess', () => {
  it('serves eleven repositories from one group token and one own token, not eleven', async () => {
    const vc = versionControl({ grantGroups: true });
    const access = groupedRepositoryAccess(vc, 'org-1', elevenRepositories);

    const results = await Promise.all(elevenRepositories.map(id => access(id)));

    expect(vc.mints).toEqual([elevenRepositories.slice(0, 10), ['repo-10']]);
    expect(results[0]).toEqual({
      cloneUrl: 'https://github.com/acme/repo-0.git',
      authorization: { scheme: 'bearer', token: 'group-1' },
    });
    expect(results[9]!.cloneUrl).toBe('https://github.com/acme/repo-9.git');
    expect(results[9]!.authorization?.token).toBe('group-1');
    expect(results[10]!.authorization?.token).toBe('repo-repo-10');
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
