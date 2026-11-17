import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCommitOnBranch, getBranchHead, SignedCommitError } from './commits.js';

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

describe('createCommitOnBranch', () => {
  const ACCESS_TOKEN = { token: 't0k' };
  const NEW_SHA = 'c'.repeat(40);
  const INPUT = {
    repository: 'acme/repo',
    branch: 'session/work',
    expectedHeadSha: 'a'.repeat(40),
    headline: 'fix: the thing',
    body: 'Because it was wrong.\n\nCo-authored-by: Someone <someone@example.com>',
    additions: [{ path: 'src/a.ts', contents: 'YQ==' }],
    deletions: [{ path: 'src/gone.ts' }],
  };

  function respondWithJson(body: unknown, ok = true, status = 200) {
    const fetchMock = vi.fn(async () => ({ ok, status, json: async () => body }) as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('creates the commit on the branch with the expected head and base64 file changes', async () => {
    const fetchMock = respondWithJson({ data: { createCommitOnBranch: { commit: { oid: NEW_SHA } } } });

    expect(await createCommitOnBranch(ACCESS_TOKEN, INPUT)).toEqual({ sha: NEW_SHA });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.github.com/graphql');
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer t0k');
    expect(headers.accept).toBe('application/vnd.github+json');
    const payload = JSON.parse(String(init.body)) as { query: string; variables: { input: unknown } };
    expect(payload.query).toContain('createCommitOnBranch');
    expect(payload.variables.input).toEqual({
      branch: { repositoryNameWithOwner: 'acme/repo', branchName: 'session/work' },
      expectedHeadOid: 'a'.repeat(40),
      message: {
        headline: 'fix: the thing',
        body: 'Because it was wrong.\n\nCo-authored-by: Someone <someone@example.com>',
      },
      fileChanges: {
        additions: [{ path: 'src/a.ts', contents: 'YQ==' }],
        deletions: [{ path: 'src/gone.ts' }],
      },
    });
  });

  it('leaves out a message body and file-change kinds the commit does not have', async () => {
    const fetchMock = respondWithJson({ data: { createCommitOnBranch: { commit: { oid: NEW_SHA } } } });

    await createCommitOnBranch(ACCESS_TOKEN, {
      repository: 'acme/repo',
      branch: 'session/work',
      expectedHeadSha: 'a'.repeat(40),
      headline: 'chore: delete',
      deletions: [{ path: 'src/gone.ts' }],
    });

    const payload = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as {
      variables: { input: { message: unknown; fileChanges: unknown } };
    };
    expect(payload.variables.input.message).toEqual({ headline: 'chore: delete' });
    expect(payload.variables.input.fileChanges).toEqual({ deletions: [{ path: 'src/gone.ts' }] });
  });

  it('treats a rejected request as definite', async () => {
    respondWithJson({ message: 'Bad request' }, false, 422);

    await expect(createCommitOnBranch(ACCESS_TOKEN, INPUT)).rejects.toMatchObject({
      name: 'SignedCommitError',
      ambiguous: false,
    });
  });

  it('treats a server error as ambiguous, because the write may have landed', async () => {
    respondWithJson({ message: 'Server error' }, false, 500);

    await expect(createCommitOnBranch(ACCESS_TOKEN, INPUT)).rejects.toMatchObject({
      name: 'SignedCommitError',
      ambiguous: true,
    });
  });

  it('surfaces a GraphQL error as a definite refusal', async () => {
    respondWithJson({ errors: [{ message: 'expectedHeadOid does not match' }] });

    await expect(createCommitOnBranch(ACCESS_TOKEN, INPUT)).rejects.toMatchObject({
      ambiguous: false,
      message: expect.stringContaining('expectedHeadOid does not match') as unknown as string,
    });
  });

  it('treats a response without a commit sha as ambiguous', async () => {
    respondWithJson({ data: { createCommitOnBranch: { commit: { oid: 'nope' } } } });

    await expect(createCommitOnBranch(ACCESS_TOKEN, INPUT)).rejects.toMatchObject({
      ambiguous: true,
      message: expect.stringContaining('no commit sha') as unknown as string,
    });
  });

  it('treats a transport failure as ambiguous', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('socket hang up');
      }),
    );

    const error = await createCommitOnBranch(ACCESS_TOKEN, INPUT).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SignedCommitError);
    expect((error as SignedCommitError).ambiguous).toBe(true);
  });
});
