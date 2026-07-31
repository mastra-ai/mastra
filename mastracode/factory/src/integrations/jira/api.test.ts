import { afterEach, describe, expect, it, vi } from 'vitest';

import { JIRA_ISSUE_FIELDS, JiraApiClient, JiraApiError } from './api.js';

const BASE = 'https://acme.atlassian.net';

function client(): JiraApiClient {
  return new JiraApiClient({ baseUrl: `${BASE}/`, email: 'ops@acme.test', apiToken: 'jira-token' });
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
  const [url, init] = fetchMock.mock.calls[call] as [URL, RequestInit];
  return { url: String(url), init };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('JiraApiClient construction', () => {
  it('throws when a config value is missing', () => {
    expect(() => new JiraApiClient({ baseUrl: BASE, email: '', apiToken: 'tok' })).toThrow(/missing required config/);
  });

  it('normalizes the base URL by stripping trailing slashes', () => {
    expect(client().baseUrl).toBe(BASE);
  });
});

describe('JiraApiClient requests', () => {
  it('lists projects with Basic auth and classic paging params', async () => {
    const fetchMock = stubFetch(jsonResponse({ values: [{ id: '1', key: 'ENG', name: 'Eng' }], startAt: 0, isLast: true }));

    const page = await client().listProjects({ startAt: 50 });

    const { url, init } = requestOf(fetchMock);
    expect(url).toBe(`${BASE}/rest/api/3/project/search?startAt=50&maxResults=50`);
    expect(init.method).toBe('GET');
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Basic ${Buffer.from('ops@acme.test:jira-token').toString('base64')}`);
    expect(page.isLast).toBe(true);
    expect(page.values[0]?.key).toBe('ENG');
  });

  it('searches issues via POST /search/jql with explicit fields and threads the cursor', async () => {
    const fetchMock = stubFetch(jsonResponse({ issues: [], nextPageToken: 'page-2' }));

    const page = await client().searchIssues({ jql: 'project IN (1) ORDER BY updated DESC', nextPageToken: 'page-1' });

    const search = requestOf(fetchMock);
    expect(search.url).toBe(`${BASE}/rest/api/3/search/jql`);
    expect(search.init.method).toBe('POST');
    const body = JSON.parse(String(search.init.body)) as Record<string, unknown>;
    expect(body).toEqual({
      jql: 'project IN (1) ORDER BY updated DESC',
      fields: [...JIRA_ISSUE_FIELDS],
      maxResults: 30,
      nextPageToken: 'page-1',
    });
    expect(page.nextPageToken).toBe('page-2');
  });

  it('omits nextPageToken from the first search page', async () => {
    const fetchMock = stubFetch(jsonResponse({ issues: [] }));

    await client().searchIssues({ jql: 'ORDER BY updated DESC' });

    const body = JSON.parse(String(requestOf(fetchMock).init.body)) as Record<string, unknown>;
    expect('nextPageToken' in body).toBe(false);
  });

  it('fetches issue detail with the explicit field list and an encoded key', async () => {
    const fetchMock = stubFetch(jsonResponse({ id: '10001', key: 'ENG-42', fields: { summary: 'Fix intake' } }));

    const issue = await client().getIssue('ENG-42');

    const { url } = requestOf(fetchMock);
    expect(url).toBe(`${BASE}/rest/api/3/issue/ENG-42?fields=${encodeURIComponent(JIRA_ISSUE_FIELDS.join(','))}`);
    expect(issue.key).toBe('ENG-42');
  });

  it('lists comments with the comment page size', async () => {
    const fetchMock = stubFetch(jsonResponse({ comments: [], startAt: 0, maxResults: 50, total: 0 }));

    await client().listComments('ENG-42');

    expect(requestOf(fetchMock).url).toBe(`${BASE}/rest/api/3/issue/ENG-42/comment?startAt=0&maxResults=50`);
  });

  it('wraps created comments in an ADF document', async () => {
    const fetchMock = stubFetch(jsonResponse({ id: 'c-1', created: '2026-07-30T00:00:00Z' }));

    await client().createComment('ENG-42', 'Done\nShipping now');

    const { url, init } = requestOf(fetchMock);
    expect(url).toBe(`${BASE}/rest/api/3/issue/ENG-42/comment`);
    const body = JSON.parse(String(init.body)) as { body: { type: string; version: number; content: unknown[] } };
    expect(body.body.type).toBe('doc');
    expect(body.body.version).toBe(1);
    expect(body.body.content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'Done' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Shipping now' }] },
    ]);
  });

  it('lists transitions and applies one (204 response)', async () => {
    const fetchMock = vi.fn(async (_url: URL, init?: RequestInit) =>
      init?.method === 'POST'
        ? new Response(null, { status: 204 })
        : jsonResponse({ transitions: [{ id: '31', name: 'Done', to: { name: 'Done', statusCategory: { key: 'done' } } }] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const jira = client();

    const transitions = await jira.listTransitions('ENG-42');
    expect(transitions).toEqual([{ id: '31', name: 'Done', to: { name: 'Done', statusCategory: { key: 'done' } } }]);

    await expect(jira.applyTransition('ENG-42', '31')).resolves.toBeUndefined();
    const post = requestOf(fetchMock, 1);
    expect(post.url).toBe(`${BASE}/rest/api/3/issue/ENG-42/transitions`);
    expect(JSON.parse(String(post.init.body))).toEqual({ transition: { id: '31' } });
  });
});

describe('JiraApiClient error normalization', () => {
  it('maps 401 to a jira_auth_failed error with Jira detail', async () => {
    stubFetch(jsonResponse({ errorMessages: ['Basic auth with password is not allowed'] }, 401));

    const failure = client().listProjects();
    await expect(failure).rejects.toBeInstanceOf(JiraApiError);
    await expect(failure).rejects.toMatchObject({
      code: 'jira_auth_failed',
      status: 401,
      message: 'Jira API request failed (401): Basic auth with password is not allowed',
    });
  });

  it('maps 403 to jira_auth_failed', async () => {
    stubFetch(jsonResponse({ errorMessages: [] }, 403));

    await expect(client().getIssue('ENG-42')).rejects.toMatchObject({ code: 'jira_auth_failed', status: 403 });
  });

  it('surfaces field-keyed errors from 400 responses as jira_request_failed', async () => {
    stubFetch(jsonResponse({ errors: { jql: 'The JQL query is invalid.' } }, 400));

    await expect(client().searchIssues({ jql: 'nope' })).rejects.toMatchObject({
      code: 'jira_request_failed',
      status: 400,
      message: 'Jira API request failed (400): The JQL query is invalid.',
    });
  });

  it('falls back to the status code alone for non-JSON error bodies', async () => {
    stubFetch(new Response('<html>gateway timeout</html>', { status: 502 }));

    await expect(client().listProjects()).rejects.toMatchObject({
      code: 'jira_request_failed',
      status: 502,
      message: 'Jira API request failed (502)',
    });
  });
});
