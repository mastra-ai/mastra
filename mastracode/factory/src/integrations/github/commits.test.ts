import { afterEach, describe, expect, it, vi } from 'vitest';

import { getBranchHead, listRepositoryCommits } from './commits.js';

const ACCESS = {
  cloneUrl: 'https://github.com/acme/repo.git',
  authorization: { scheme: 'bearer' as const, token: 't0k' },
};

function github() {
  return { versionControl: { getRepositoryAccess: vi.fn(async () => ACCESS) } };
}

const INPUT = {
  orgId: 'org1',
  project: { repository: { id: 'repo1', slug: 'acme/repo' } },
  branch: 'main',
  limit: 2,
};

function respondWith(body: unknown, ok = true, status = 200) {
  const fetchMock = vi.fn(async () => ({ ok, status, json: async () => body }) as unknown as Response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('listRepositoryCommits', () => {
  it('reads with the installation token the clone uses, not an Octokit the Platform build stubs out', async () => {
    const fetchMock = respondWith([]);

    await listRepositoryCommits(github(), INPUT);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/acme/repo/commits?sha=main&per_page=2');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer t0k');
  });

  it('keeps the subject line and prefers the GitHub login over the commit author name', async () => {
    respondWith([
      {
        sha: 'abc123',
        html_url: 'https://github.com/acme/repo/commit/abc123',
        commit: {
          message: 'fix(factory): stop the drift\n\nlonger body',
          author: { name: 'Ada', date: '2026-08-31T10:00:00Z' },
        },
        author: { login: 'ada', avatar_url: 'https://avatars/ada' },
      },
    ]);

    expect(await listRepositoryCommits(github(), INPUT)).toEqual([
      {
        sha: 'abc123',
        message: 'fix(factory): stop the drift',
        author: 'ada',
        avatarUrl: 'https://avatars/ada',
        committedAt: '2026-08-31T10:00:00Z',
        url: 'https://github.com/acme/repo/commit/abc123',
      },
    ]);
  });

  it('falls back to the commit author when GitHub has no matching account', async () => {
    respondWith([
      {
        sha: 'def456',
        html_url: 'https://github.com/acme/repo/commit/def456',
        commit: { message: 'chore: bump', author: { name: 'Ada', date: '2026-08-31T10:00:00Z' } },
        author: null,
      },
    ]);

    expect((await listRepositoryCommits(github(), INPUT))[0]?.author).toBe('Ada');
  });

  it('surfaces a rejected listing instead of reporting an empty history', async () => {
    respondWith({ message: 'Not Found' }, false, 404);

    await expect(listRepositoryCommits(github(), INPUT)).rejects.toThrow('(404)');
  });
});

describe('getBranchHead', () => {
  const SHA = 'a'.repeat(40);
  const HEAD_INPUT = { orgId: 'org1', repository: { id: 'repo1', slug: 'acme/repo' }, branch: 'release/v1' };

  function respondWithText(text: string, ok = true, status = 200) {
    const fetchMock = vi.fn(async () => ({ ok, status, text: async () => text }) as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('asks for the sha media type on the branch commit with the repository token', async () => {
    const fetchMock = respondWithText(`${SHA}\n`);

    expect(await getBranchHead(github(), HEAD_INPUT)).toBe(SHA);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/repos/acme/repo/commits/release%2Fv1');
    const headers = init.headers as Record<string, string>;
    expect(headers.accept).toBe('application/vnd.github.sha');
    expect(headers.authorization).toBe('Bearer t0k');
  });

  it('surfaces a rejected lookup', async () => {
    respondWithText('', false, 404);

    await expect(getBranchHead(github(), HEAD_INPUT)).rejects.toThrow('acme/repo@release/v1 (404)');
  });

  it('rejects a body that is not a full sha', async () => {
    respondWithText('<html>');

    await expect(getBranchHead(github(), HEAD_INPUT)).rejects.toThrow('no commit sha');
  });
});
