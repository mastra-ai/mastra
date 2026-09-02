import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlatformApiClient } from '../api-client.js';
import { JIRA_ISSUE_FIELDS, PlatformJiraApiClient, PlatformJiraApiError } from './api.js';

const BASE = 'https://integrations.example.com';
const CONNECTION_ID = 'a1b_jira';

function client(): PlatformJiraApiClient {
  return new PlatformJiraApiClient({
    client: new PlatformApiClient({ baseUrl: BASE, accessToken: 'platform-token' }),
    connectionId: CONNECTION_ID,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function stubFetch(response: Response | (() => Response)): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => (typeof response === 'function' ? response() : response));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function requestOf(fetchMock: ReturnType<typeof vi.fn>, call = 0): { url: string; init: RequestInit } {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  return { url, init };
}

afterEach(() => vi.unstubAllGlobals());

describe('PlatformJiraApiClient', () => {
  it('requires a connection id', () => {
    const platform = new PlatformApiClient({ baseUrl: BASE, accessToken: 'platform-token' });
    expect(() => new PlatformJiraApiClient({ client: platform, connectionId: '' })).toThrow(/connectionId/);
  });

  it('lists projects through the integrations v2 proxy', async () => {
    const fetchMock = stubFetch(
      jsonResponse({ values: [{ id: '1', key: 'ENG', name: 'Engineering' }], startAt: 50, isLast: true }),
    );

    const page = await client().listProjects({ startAt: 50 });

    expect(requestOf(fetchMock).url).toBe(
      `${BASE}/v2/connections/${CONNECTION_ID}/proxy/rest/api/3/project/search?startAt=50&maxResults=50`,
    );
    expect(requestOf(fetchMock).init.headers).toMatchObject({ authorization: 'Bearer platform-token' });
    expect(page.values[0]?.key).toBe('ENG');
  });

  it('searches issues with explicit fields and an opaque Jira cursor', async () => {
    const fetchMock = stubFetch(jsonResponse({ issues: [], nextPageToken: 'page-2' }));

    await expect(
      client().searchIssues({ jql: 'project IN (1) ORDER BY updated DESC', nextPageToken: 'page-1' }),
    ).resolves.toMatchObject({ nextPageToken: 'page-2' });

    const request = requestOf(fetchMock);
    expect(request.url).toBe(`${BASE}/v2/connections/${CONNECTION_ID}/proxy/rest/api/3/search/jql`);
    expect(JSON.parse(String(request.init.body))).toEqual({
      jql: 'project IN (1) ORDER BY updated DESC',
      fields: [...JIRA_ISSUE_FIELDS],
      maxResults: 30,
      nextPageToken: 'page-1',
    });
  });

  it('fetches encoded issue keys and comment pages through the same connection', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ id: '1', key: 'ENG/42', fields: {} }))
      .mockResolvedValueOnce(jsonResponse({ comments: [], startAt: 0, maxResults: 50, total: 0 }));
    vi.stubGlobal('fetch', fetchMock);

    await client().getIssue('ENG/42');
    await client().listComments('ENG/42');

    expect(requestOf(fetchMock, 0).url).toContain('/issue/ENG%2F42?fields=');
    expect(requestOf(fetchMock, 1).url).toContain('/issue/ENG%2F42/comment?startAt=0&maxResults=50');
  });

  it('wraps comments in ADF and supports 204 transition responses', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ id: 'c-1', created: '2026-07-30T00:00:00Z' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await client().createComment('ENG-42', 'Done\nShipping now');
    await expect(client().applyTransition('ENG-42', '31')).resolves.toBeUndefined();

    expect(JSON.parse(String(requestOf(fetchMock, 0).init.body))).toEqual({
      body: {
        type: 'doc',
        version: 1,
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Done' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Shipping now' }] },
        ],
      },
    });
  });

  it.each([
    [401, 'jira_auth_failed'],
    [403, 'jira_auth_failed'],
    [429, 'jira_request_failed'],
    [500, 'jira_request_failed'],
  ] as const)('normalizes proxy status %s as %s', async (status, code) => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    stubFetch(jsonResponse({ detail: 'provider failed' }, status));
    const error = await client()
      .getIssue('ENG-42')
      .catch(caught => caught);
    expect(error).toBeInstanceOf(PlatformJiraApiError);
    expect(error).toMatchObject({ status, code, message: 'provider failed' });
  });
});
