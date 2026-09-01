import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlatformApiClient } from '../platform/api-client.js';
import { GitLabApiClient, GitLabApiError } from './api.js';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function requestOf(fetchMock: ReturnType<typeof vi.fn>, call = 0): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  return { url, init };
}

afterEach(() => vi.unstubAllGlobals());

describe('GitLabApiClient', () => {
  it('validates direct configuration', () => {
    expect(() => new GitLabApiClient({ baseUrl: 'gitlab.com', accessToken: 'token' })).toThrow(/absolute HTTP/);
    expect(() => new GitLabApiClient({ baseUrl: 'https://gitlab.com', accessToken: ' ' })).toThrow(/accessToken/);
  });

  it('lists projects directly with a private token', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json([]));
    const client = new GitLabApiClient({
      baseUrl: 'https://gitlab.example.com/',
      accessToken: 'group-token',
      fetchImpl: fetchMock,
    });

    await client.listProjects({ page: 2 });

    const request = requestOf(fetchMock);
    expect(request.url).toBe(
      'https://gitlab.example.com/api/v4/projects?membership=true&simple=true&with_issues_enabled=true&order_by=last_activity_at&sort=desc&page=2&per_page=100',
    );
    expect(request.init.headers).toMatchObject({ 'private-token': 'group-token' });
  });

  it('routes issue reads and writes through the integrations v2 proxy', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(json({ id: 9, body: 'done', created_at: '2026-09-01T00:00:00Z' }))
      .mockResolvedValueOnce(json({ id: 7, iid: 42, state: 'closed' }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new GitLabApiClient({
      client: new PlatformApiClient({ baseUrl: 'https://integrations.example.com', accessToken: 'platform-token' }),
      connectionId: 'a1b_gitlab',
    });

    await client.listIssues('group/project', { labels: ['bug', 'urgent'] });
    await client.createNote('group/project', 42, 'done');
    await client.updateIssueState('group/project', 42, 'close');

    expect(requestOf(fetchMock, 0).url).toBe(
      'https://integrations.example.com/v2/connections/a1b_gitlab/proxy/api/v4/projects/group%2Fproject/issues?state=opened&scope=all&order_by=updated_at&sort=desc&page=1&per_page=30&labels=bug%2Curgent',
    );
    expect(requestOf(fetchMock, 0).init.headers).toMatchObject({ authorization: 'Bearer platform-token' });
    expect(JSON.parse(String(requestOf(fetchMock, 1).init.body))).toEqual({ body: 'done' });
    expect(requestOf(fetchMock, 2).init.method).toBe('PUT');
    expect(JSON.parse(String(requestOf(fetchMock, 2).init.body))).toEqual({ state_event: 'close' });
  });

  it.each([
    [401, 'gitlab_auth_failed'],
    [403, 'gitlab_auth_failed'],
    [429, 'gitlab_request_failed'],
    [500, 'gitlab_request_failed'],
  ] as const)('normalizes response status %s as %s', async (status, code) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json({ message: 'provider failed' }, status));
    const client = new GitLabApiClient({
      baseUrl: 'https://gitlab.com',
      accessToken: 'group-token',
      fetchImpl: fetchMock,
    });

    const error = await client.getIssue('group/project', 42).catch(caught => caught);

    expect(error).toBeInstanceOf(GitLabApiError);
    expect(error).toMatchObject({ status, code, message: 'provider failed' });
  });
});
