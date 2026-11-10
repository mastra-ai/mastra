import { describe, expect, it, vi } from 'vitest';

import {
  cloneUrlSlug,
  headsChanged,
  matchEnvironmentSlug,
  recordedHeadResolver,
  resolveCurrentHeads,
} from './heads.js';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

describe('cloneUrlSlug', () => {
  it.each([
    ['https://github.com/Acme/Repo.git', 'acme/repo'],
    ['https://github.com/acme/repo', 'acme/repo'],
    ['https://x-access-token:secret@github.com/acme/repo.git', 'acme/repo'],
    ['git@github.com:acme/repo.git', 'acme/repo'],
    ['ssh://git@github.com/acme/repo.git', 'acme/repo'],
  ])('%s -> %s', (url, slug) => {
    expect(cloneUrlSlug(url)).toBe(slug);
  });

  it('is undefined for a URL without an owner and repository', () => {
    expect(cloneUrlSlug('https://github.com/')).toBeUndefined();
    expect(cloneUrlSlug('not a url')).toBeUndefined();
  });
});

describe('matchEnvironmentSlug', () => {
  it("returns the environment's own spelling of the slug", () => {
    expect(matchEnvironmentSlug('https://github.com/acme/repo.git', ['Acme/Repo', 'acme/other'])).toBe('Acme/Repo');
  });

  it('is undefined for a repository outside the environment', () => {
    expect(matchEnvironmentSlug('https://github.com/acme/repo.git', ['acme/other'])).toBeUndefined();
  });
});

describe('recordedHeadResolver', () => {
  it('answers from recorded heads keyed by clone URL and leaves unknown repositories to the template', async () => {
    const resolve = recordedHeadResolver({ 'acme/repo': SHA_A });

    expect(await resolve('https://github.com/ACME/repo.git')).toBe(SHA_A);
    expect(await resolve('https://github.com/acme/other.git')).toBeUndefined();
  });
});

describe('headsChanged', () => {
  it('is true before any build is recorded', () => {
    expect(headsChanged(null, { 'acme/repo': SHA_A })).toBe(true);
  });

  it('is false when every repository is at its recorded head', () => {
    expect(headsChanged({ 'acme/repo': SHA_A }, { 'acme/repo': SHA_A })).toBe(false);
  });

  it('is true when a head moved or the repository set differs', () => {
    expect(headsChanged({ 'acme/repo': SHA_A }, { 'acme/repo': SHA_B })).toBe(true);
    expect(headsChanged({ 'acme/repo': SHA_A }, { 'acme/repo': SHA_A, 'acme/other': SHA_B })).toBe(true);
    expect(headsChanged({ 'acme/repo': SHA_A, 'acme/other': SHA_B }, { 'acme/repo': SHA_A })).toBe(true);
  });
});

describe('resolveCurrentHeads', () => {
  it('looks up the pinned ref of every repository with its own token and keys the result by slug', async () => {
    const getRepositoryAccess = vi.fn(async ({ repositoryId }: { repositoryId: string }) => ({
      cloneUrl: `https://github.com/acme/${repositoryId}.git`,
      authorization: { scheme: 'bearer' as const, token: `token-${repositoryId}` },
    }));
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      text: async () => (url.includes('/acme/repo/') ? SHA_A : SHA_B),
    }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const heads = await resolveCurrentHeads(
        { versionControl: { getRepositoryAccess } },
        {
          orgId: 'org1',
          repositories: [
            { id: 'repo', slug: 'acme/repo', branch: 'main' },
            { id: 'other', slug: 'acme/other', branch: 'develop' },
          ],
        },
      );
      expect(heads).toEqual({ 'acme/repo': SHA_A, 'acme/other': SHA_B });
      const calls = fetchMock.mock.calls.map(([url, init]) => [url, (init as RequestInit).headers]);
      expect(calls).toEqual([
        [
          'https://api.github.com/repos/acme/repo/commits/main',
          expect.objectContaining({ authorization: 'Bearer token-repo' }),
        ],
        [
          'https://api.github.com/repos/acme/other/commits/develop',
          expect.objectContaining({ authorization: 'Bearer token-other' }),
        ],
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
