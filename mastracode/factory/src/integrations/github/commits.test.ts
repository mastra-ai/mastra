import { afterEach, describe, expect, it, vi } from 'vitest';

import { getBranchHead } from './commits.js';

const ACCESS = {
  cloneUrl: 'https://github.com/acme/repo.git',
  authorization: { scheme: 'bearer' as const, token: 't0k' },
};

function github() {
  return { versionControl: { getRepositoryAccess: vi.fn(async () => ACCESS) } };
}

afterEach(() => vi.unstubAllGlobals());

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
