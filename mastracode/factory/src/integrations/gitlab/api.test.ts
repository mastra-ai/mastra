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
    expect(() => new GitLabApiClient({ baseUrl: 'http://gitlab.example.com', accessToken: 'token' })).toThrow(
      /must use HTTPS/,
    );
    expect(() => new GitLabApiClient({ baseUrl: 'http://localhost:8080', accessToken: 'token' })).not.toThrow();
    expect(() => new GitLabApiClient({ baseUrl: 'http://127.0.0.1:8080', accessToken: 'token' })).not.toThrow();
    expect(() => new GitLabApiClient({ baseUrl: 'http://[::1]:8080', accessToken: 'token' })).not.toThrow();
  });

  it('checks the current identity without listing projects', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json({ id: 7, username: 'rhys' }));
    const client = new GitLabApiClient({
      baseUrl: 'https://gitlab.example.com',
      accessToken: 'personal-token',
      fetchImpl: fetchMock,
    });

    await expect(client.getCurrentUser()).resolves.toMatchObject({ username: 'rhys' });

    const request = requestOf(fetchMock);
    expect(request.url).toBe('https://gitlab.example.com/api/v4/user');
    expect(request.init.headers).toMatchObject({ 'private-token': 'personal-token' });
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
      'https://gitlab.example.com/api/v4/projects?membership=true&simple=true&with_issues_enabled=true&min_access_level=20&order_by=last_activity_at&sort=desc&page=2&per_page=100',
    );
    expect(request.init.headers).toMatchObject({ 'private-token': 'group-token' });
  });

  it('routes issue reads and writes through the integrations v2 proxy', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json([
          {
            id: 1,
            iid: 7,
            project_id: 9,
            title: 'Fix it',
            state: 'opened',
            web_url: 'https://gitlab.example/group/project/-/issues/7',
            labels: [{ name: 'bug', color: '#d73a4a', text_color: '#ffffff' }],
            created_at: '2026-09-01T00:00:00Z',
            updated_at: '2026-09-01T00:00:00Z',
          },
        ]),
      )
      .mockResolvedValueOnce(json({ id: 9, body: 'done', created_at: '2026-09-01T00:00:00Z' }))
      .mockResolvedValueOnce(json({ id: 7, iid: 42, state: 'closed' }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new GitLabApiClient({
      client: new PlatformApiClient({ baseUrl: 'https://integrations.example.com', accessToken: 'platform-token' }),
      connectionId: 'a1b_gitlab',
    });

    const issues = await client.listIssues('group/project', { labels: ['bug', 'urgent'] });
    expect(issues[0]).toMatchObject({
      labels: ['bug'],
      labelDetails: [{ name: 'bug', color: '#d73a4a', text_color: '#ffffff' }],
    });
    await client.createNote('group/project', 42, 'done');
    await client.updateIssueState('group/project', 42, 'close');

    expect(requestOf(fetchMock, 0).url).toBe(
      'https://integrations.example.com/v2/connections/a1b_gitlab/proxy/api/v4/projects/group%2Fproject/issues?state=opened&scope=all&order_by=updated_at&sort=desc&page=1&per_page=30&labels=bug%2Curgent&with_labels_details=true',
    );
    expect(requestOf(fetchMock, 0).init.headers).toMatchObject({ authorization: 'Bearer platform-token' });
    expect(JSON.parse(String(requestOf(fetchMock, 1).init.body))).toEqual({ body: 'done' });
    expect(requestOf(fetchMock, 2).init.method).toBe('PUT');
    expect(JSON.parse(String(requestOf(fetchMock, 2).init.body))).toEqual({ state_event: 'close' });
  });

  it('sends merge request, discussion, approval, reviewer, and member requests directly', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => Promise.resolve(json({})));
    const client = new GitLabApiClient({
      baseUrl: 'https://gitlab.example.com',
      accessToken: 'group-token',
      fetchImpl: fetchMock,
    });
    const position = {
      position_type: 'text' as const,
      base_sha: 'base-sha',
      start_sha: 'start-sha',
      head_sha: 'head-sha',
      old_path: 'src/old.ts',
      new_path: 'src/new.ts',
      new_line: 42,
    };

    await client.createMergeRequest('group/project', {
      sourceBranch: 'feature',
      targetBranch: 'main',
      title: 'Add feature',
      description: 'Details',
    });
    await client.mergeMergeRequest('group/project', 17, { squash: true });
    await client.createMergeRequestDiscussion('group/project', 17, {
      body: 'Please revise',
      commitId: 'head-sha',
      position,
    });
    await client.approveMergeRequest('group/project', 17, 'head-sha');
    await client.setMergeRequestReviewers('group/project', 17, [11, 22]);
    await client.listProjectMembers('group/project', { query: 'alice', page: 2 });
    await client.getMergeRequestDiscussion('group/project', 17, 'discussion/1');
    await client.resolveMergeRequestDiscussion('group/project', 17, 'discussion/1', true);

    expect(requestOf(fetchMock, 0)).toMatchObject({
      url: 'https://gitlab.example.com/api/v4/projects/group%2Fproject/merge_requests',
      init: { method: 'POST' },
    });
    expect(JSON.parse(String(requestOf(fetchMock, 0).init.body))).toEqual({
      source_branch: 'feature',
      target_branch: 'main',
      title: 'Add feature',
      description: 'Details',
    });
    expect(requestOf(fetchMock, 1)).toMatchObject({
      url: 'https://gitlab.example.com/api/v4/projects/group%2Fproject/merge_requests/17/merge',
      init: { method: 'PUT' },
    });
    expect(JSON.parse(String(requestOf(fetchMock, 1).init.body))).toEqual({ squash: true });
    expect(requestOf(fetchMock, 2)).toMatchObject({
      url: 'https://gitlab.example.com/api/v4/projects/group%2Fproject/merge_requests/17/discussions',
      init: { method: 'POST' },
    });
    expect(JSON.parse(String(requestOf(fetchMock, 2).init.body))).toEqual({
      body: 'Please revise',
      commit_id: 'head-sha',
      position,
    });
    expect(requestOf(fetchMock, 3)).toMatchObject({
      url: 'https://gitlab.example.com/api/v4/projects/group%2Fproject/merge_requests/17/approve',
      init: { method: 'POST' },
    });
    expect(JSON.parse(String(requestOf(fetchMock, 3).init.body))).toEqual({ sha: 'head-sha' });
    expect(requestOf(fetchMock, 4)).toMatchObject({
      url: 'https://gitlab.example.com/api/v4/projects/group%2Fproject/merge_requests/17',
      init: { method: 'PUT' },
    });
    expect(JSON.parse(String(requestOf(fetchMock, 4).init.body))).toEqual({ reviewer_ids: [11, 22] });
    expect(requestOf(fetchMock, 5).url).toBe(
      'https://gitlab.example.com/api/v4/projects/group%2Fproject/members/all?query=alice&page=2&per_page=100',
    );
    expect(requestOf(fetchMock, 6).url).toBe(
      'https://gitlab.example.com/api/v4/projects/group%2Fproject/merge_requests/17/discussions/discussion%2F1',
    );
    expect(requestOf(fetchMock, 7)).toMatchObject({
      url: 'https://gitlab.example.com/api/v4/projects/group%2Fproject/merge_requests/17/discussions/discussion%2F1',
      init: { method: 'PUT' },
    });
    expect(JSON.parse(String(requestOf(fetchMock, 7).init.body))).toEqual({ resolved: true });
  });

  it('routes merge request requests through the integrations v2 proxy', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json({ iid: 17 }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new GitLabApiClient({
      client: new PlatformApiClient({ baseUrl: 'https://integrations.example.com', accessToken: 'platform-token' }),
      connectionId: 'a1b_gitlab',
    });

    await client.createMergeRequest('group/project', {
      sourceBranch: 'feature',
      targetBranch: 'main',
      title: 'Add feature',
    });

    expect(requestOf(fetchMock)).toMatchObject({
      url: 'https://integrations.example.com/v2/connections/a1b_gitlab/proxy/api/v4/projects/group%2Fproject/merge_requests',
      init: { method: 'POST' },
    });
    expect(requestOf(fetchMock).init.headers).toMatchObject({ authorization: 'Bearer platform-token' });
  });

  it('uses the numeric project ID from a repository target while retaining its path for UI links', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => json({ iid: 17 }));
    vi.stubGlobal('fetch', fetchMock);
    const platformClient = new GitLabApiClient({
      client: new PlatformApiClient({ baseUrl: 'https://integrations.example.com', accessToken: 'platform-token' }),
      connectionId: 'a1b_gitlab',
    });
    const directClient = new GitLabApiClient({
      baseUrl: 'https://gitlab.example.com',
      accessToken: 'direct-token',
      fetchImpl: fetchMock,
    });

    await platformClient.getMergeRequest('101:group/project', 17);
    await directClient.getMergeRequest('101:group/project', 17);

    expect(requestOf(fetchMock, 0).url).toBe(
      'https://integrations.example.com/v2/connections/a1b_gitlab/proxy/api/v4/projects/101/merge_requests/17',
    );
    expect(requestOf(fetchMock, 1).url).toBe('https://gitlab.example.com/api/v4/projects/101/merge_requests/17');
  });

  it('retrieves an individual merge request note through the numeric project target', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => json({ id: 94, body: 'Reviewed' }));
    vi.stubGlobal('fetch', fetchMock);
    const client = new GitLabApiClient({
      client: new PlatformApiClient({ baseUrl: 'https://integrations.example.com', accessToken: 'platform-token' }),
      connectionId: 'a1b_gitlab',
    });

    await expect(client.getMergeRequestNote('101:group/project', 17, 94)).resolves.toMatchObject({ id: 94 });
    expect(requestOf(fetchMock).url).toBe(
      'https://integrations.example.com/v2/connections/a1b_gitlab/proxy/api/v4/projects/101/merge_requests/17/notes/94',
    );
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
