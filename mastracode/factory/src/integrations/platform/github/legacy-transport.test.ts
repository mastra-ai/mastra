import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPlatformConnectClient } from '../platform-connect.js';
import { LegacyGithubTransport } from './legacy-transport.js';

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

function transport(fetchImpl: typeof fetch): LegacyGithubTransport {
  vi.stubGlobal('fetch', fetchImpl);
  return new LegacyGithubTransport(
    createPlatformConnectClient({ baseUrl: 'https://platform.test', accessToken: 'secret', projectId: 'project-1' }),
  );
}

function calls(fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>) {
  return fetchImpl.mock.calls.map(([input, init]) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    return { method: request.method, url: request.url, actingUser: request.headers.get('x-acting-user-id') };
  });
}

const repository = 'acme/app';

describe('LegacyGithubTransport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the platform GitHub routes and unwraps their list envelopes', async () => {
    const pullRequest = { number: 7, title: 'Fix', htmlUrl: 'https://github.com/acme/app/pull/7' };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ pullRequests: [pullRequest] }))
      .mockResolvedValueOnce(json({ repositories: [{ id: 1, fullName: 'acme/app' }] }));
    const github = transport(fetchImpl);

    await expect(github.listPullRequests({ repository }, { state: 'open', page: 2, perPage: 50 })).resolves.toEqual([
      pullRequest,
    ]);
    await expect(github.listInstallationRepositories(42)).resolves.toEqual([{ id: 1, fullName: 'acme/app' }]);

    expect(calls(fetchImpl).map(({ method, url }) => `${method} ${url}`)).toEqual([
      'GET https://platform.test/v1/server/github/repos/acme/app/pulls?state=open&page=2&per_page=50',
      'GET https://platform.test/v1/server/github-app/installations/42/repositories',
    ]);
  });

  it('reads a repository event page after an event id, or after a time for a repository not read before', async () => {
    const page = { events: [{ id: '1700000000000-0' }], nextCursor: '1700000000000-0' };
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => json(page));
    const github = transport(fetchImpl);

    await expect(github.listRepositoryEvents(42, { afterEventId: '1699999999999-3' }, 50)).resolves.toEqual(page);
    await expect(github.listRepositoryEvents(42, { afterTimestamp: 1_699_999_000_000 }, 50)).resolves.toEqual(page);

    expect(calls(fetchImpl).map(({ method, url }) => `${method} ${url}`)).toEqual([
      'GET https://platform.test/v1/server/github-app/repositories/42/events?limit=50&afterEventId=1699999999999-3',
      'GET https://platform.test/v1/server/github-app/repositories/42/events?limit=50&afterTimestamp=1699999000000',
    ]);
  });

  it('sends the acting user on writes made for a user, and on nothing else', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => json({ comments: [], id: 1 }));
    const github = transport(fetchImpl);

    await github.createIssueComment({ repository, actingUserId: 'user-1' }, 7, 'hello');
    await github.createIssueComment({ repository }, 7, 'from Factory');
    await github.listIssueComments({ repository, actingUserId: 'user-1' }, 7, { page: 1, perPage: 100 });

    expect(calls(fetchImpl).map(({ method, actingUser }) => [method, actingUser])).toEqual([
      ['POST', 'user-1'],
      ['POST', null],
      ['GET', null],
    ]);
  });

  it('rejects a repository that is not owner/name before calling the platform', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const github = transport(fetchImpl);

    expect(() => github.getPullRequest({ repository: 'acme' }, 1)).toThrow('owner/repository');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
