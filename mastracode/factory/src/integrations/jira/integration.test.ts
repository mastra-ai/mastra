import { afterEach, describe, expect, it, vi } from 'vitest';

import { JiraApiError } from './api.js';
import { JiraIntegration } from './integration.js';

const BASE = 'https://acme.atlassian.net';

function integration(): JiraIntegration {
  return new JiraIntegration({ baseUrl: BASE, email: 'ops@acme.test', apiToken: 'jira-token' });
}

/** Contract-required connection — Jira ignores it (deployment-global credentials). */
const connection = { type: 'oauth' as const, accessToken: 'ignored' };

interface StubIssue {
  id?: string;
  key?: string;
  fields?: Record<string, unknown>;
}

function issue(overrides: StubIssue = {}): { id: string; key: string; fields: Record<string, unknown> } {
  return {
    id: '10001',
    key: 'ENG-42',
    ...overrides,
    fields: {
      summary: 'Fix intake',
      status: { name: 'To Do', statusCategory: { key: 'new' } },
      assignee: { displayName: 'Ada' },
      reporter: { displayName: 'Grace' },
      labels: ['bug'],
      priority: { name: 'High' },
      issuetype: { name: 'Bug' },
      project: { id: '1', key: 'ENG' },
      created: '2026-07-01T00:00:00Z',
      updated: '2026-07-02T00:00:00Z',
      ...overrides.fields,
    },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Route-style fetch stub: first matching [method, path-substring] wins. */
function stubRoutes(routes: Array<[string, string, () => Response]>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const target = String(url);
    const match = routes.find(([m, path]) => m === method && target.includes(path));
    if (!match) throw new Error(`Unexpected request: ${method} ${target}`);
    return match[2]();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('JiraIntegration capability surface', () => {
  it('lists sources across project-search pages', async () => {
    let call = 0;
    stubRoutes([
      [
        'GET',
        '/rest/api/3/project/search',
        () =>
          call++ === 0
            ? jsonResponse({ values: [{ id: '1', key: 'ENG', name: 'Engineering' }], startAt: 0, isLast: false })
            : jsonResponse({ values: [{ id: '2', key: 'OPS', name: 'Operations' }], startAt: 1, isLast: true }),
      ],
    ]);

    await expect(integration().intake.listSources({ orgId: 'org-1', userId: 'user-1' })).resolves.toEqual([
      { id: '1', name: 'Engineering', type: 'project', metadata: { key: 'ENG' } },
      { id: '2', name: 'Operations', type: 'project', metadata: { key: 'OPS' } },
    ]);
  });

  it('normalizes Jira issues through the shared Intake contract with sanitized JQL and cursor round-trip', async () => {
    const fetchMock = stubRoutes([
      ['POST', '/rest/api/3/search/jql', () => jsonResponse({ issues: [issue()], nextPageToken: 'page-2' })],
    ]);

    const page = await integration().intake.listIssues({
      connection,
      sourceIds: ['1', 'ENG', 'bad id;'],
      labels: ['bug', 'ur"gent'],
      cursor: 'page-1',
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { jql: string; nextPageToken?: string };
    expect(body.jql).toBe(
      'project IN (1, "ENG") AND statusCategory != Done AND labels IN ("bug", "urgent") ORDER BY updated DESC',
    );
    expect(body.nextPageToken).toBe('page-1');
    expect(page).toEqual({
      issues: [
        expect.objectContaining({
          id: '10001',
          identifier: 'ENG-42',
          title: 'Fix intake',
          url: `${BASE}/browse/ENG-42`,
          author: 'Grace',
          state: 'To Do',
          stateType: 'unstarted',
          priority: 'High',
          assignee: 'Ada',
          source: 'ENG',
          labels: ['bug'],
        }),
      ],
      nextCursor: 'page-2',
    });
  });

  it('maps issues to intake items and skips the API entirely for an empty selection', async () => {
    const fetchMock = stubRoutes([
      ['POST', '/rest/api/3/search/jql', () => jsonResponse({ issues: [issue()] })],
    ]);
    const jira = integration();

    await expect(jira.intake.listItems({ orgId: 'org-1', userId: 'user-1', sourceIds: [] })).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();

    const page = await jira.intake.listItems({ orgId: 'org-1', userId: 'user-1', sourceIds: ['1'] });
    expect(page.items).toEqual([
      expect.objectContaining({
        source: { type: 'issue', externalId: 'ENG-42', url: `${BASE}/browse/ENG-42` },
        sourceId: '1',
        title: 'ENG-42: Fix intake',
        status: 'To Do',
        labels: ['bug'],
        assignee: 'Ada',
        metadata: expect.objectContaining({ identifier: 'ENG-42', stateType: 'unstarted', project: 'ENG' }),
      }),
    ]);
  });

  it('fetches issue detail with flattened ADF description and comments', async () => {
    const description = {
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Issue body' }] }],
    };
    const commentBody = {
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Looking now' }] }],
    };
    stubRoutes([
      ['GET', '/comment', () =>
        jsonResponse({
          comments: [{ id: 'c-1', author: { displayName: 'Grace' }, body: commentBody, created: '2026-07-03T00:00:00Z' }],
          startAt: 0,
          maxResults: 50,
          total: 1,
        }),
      ],
      ['GET', '/rest/api/3/issue/ENG-42', () => jsonResponse(issue({ fields: { description } }))],
    ]);

    await expect(integration().intake.getIssue({ connection, issueId: 'ENG-42' })).resolves.toMatchObject({
      identifier: 'ENG-42',
      description: 'Issue body',
      commentCount: 1,
      comments: [{ author: 'Grace', body: 'Looking now', createdAt: '2026-07-03T00:00:00Z' }],
    });
  });

  it('returns null for an unknown issue instead of throwing', async () => {
    stubRoutes([['GET', '/rest/api/3/issue/', () => jsonResponse({ errorMessages: ['Issue does not exist'] }, 404)]]);

    await expect(integration().intake.getIssue({ connection, issueId: 'ENG-404' })).resolves.toBeNull();
  });

  it('creates ADF comments and returns a browse URL', async () => {
    stubRoutes([['POST', '/comment', () => jsonResponse({ id: 'c-9', created: '2026-07-04T00:00:00Z' })]]);

    await expect(integration().intake.createComment({ connection, issueId: 'ENG-42', body: 'Done' })).resolves.toEqual({
      id: 'c-9',
      url: `${BASE}/browse/ENG-42?focusedCommentId=c-9`,
    });
  });

  it('resolves a byType target against transitions and applies the matching one', async () => {
    const applied: string[] = [];
    let fetches = 0;
    stubRoutes([
      ['GET', '/transitions', () =>
        jsonResponse({
          transitions: [
            { id: '11', name: 'Start', to: { name: 'In Progress', statusCategory: { key: 'indeterminate' } } },
            { id: '31', name: 'Finish', to: { name: 'Done', statusCategory: { key: 'done' } } },
          ],
        }),
      ],
      ['POST', '/transitions', () => {
        applied.push('posted');
        return new Response(null, { status: 204 });
      }],
      ['GET', '/rest/api/3/issue/', () =>
        fetches++ === 0
          ? jsonResponse(issue())
          : jsonResponse(issue({ fields: { status: { name: 'Done', statusCategory: { key: 'done' } } } })),
      ],
    ]);

    const result = await integration().intake.updateIssue({
      connection,
      issueId: 'ENG-42',
      state: { kind: 'byType', stateType: 'completed' },
    });

    expect(applied).toEqual(['posted']);
    expect(result).toMatchObject({ state: 'Done', stateType: 'completed' });
  });

  it('maps byType canceled to a done-category transition whose status name contains cancel', async () => {
    let fetches = 0;
    stubRoutes([
      ['GET', '/transitions', () =>
        jsonResponse({
          transitions: [
            { id: '31', name: 'Finish', to: { name: 'Done', statusCategory: { key: 'done' } } },
            { id: '41', name: 'Abort', to: { name: 'Cancelled', statusCategory: { key: 'done' } } },
          ],
        }),
      ],
      ['POST', '/transitions', () => new Response(null, { status: 204 })],
      ['GET', '/rest/api/3/issue/', () =>
        fetches++ === 0
          ? jsonResponse(issue())
          : jsonResponse(issue({ fields: { status: { name: 'Cancelled', statusCategory: { key: 'done' } } } })),
      ],
    ]);

    const result = await integration().intake.updateIssue({
      connection,
      issueId: 'ENG-42',
      state: { kind: 'byType', stateType: 'canceled' },
    });
    expect(result).toMatchObject({ state: 'Cancelled' });
  });

  it('skips the transition when the current state already matches a byName target', async () => {
    const fetchMock = stubRoutes([['GET', '/rest/api/3/issue/', () => jsonResponse(issue())]]);

    const result = await integration().intake.updateIssue({
      connection,
      issueId: 'ENG-42',
      state: { kind: 'byName', name: 'to do' },
    });

    expect(result).toMatchObject({ state: 'To Do' });
    // Only the issue read — no transitions listed, nothing applied.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null when no legal transition reaches the target', async () => {
    stubRoutes([
      ['GET', '/transitions', () =>
        jsonResponse({
          transitions: [{ id: '11', name: 'Start', to: { name: 'In Progress', statusCategory: { key: 'indeterminate' } } }],
        }),
      ],
      ['GET', '/rest/api/3/issue/', () => jsonResponse(issue())],
    ]);

    await expect(
      integration().intake.updateIssue({ connection, issueId: 'ENG-42', state: { kind: 'byName', name: 'Blocked' } }),
    ).resolves.toBeNull();
  });

  it('resolves intake dispatches for issue sources only', async () => {
    const jira = integration();

    await expect(
      jira.intake.resolveIntakeDispatch!({ orgId: 'org-1', externalSource: { type: 'issue', externalId: 'ENG-42' } }),
    ).resolves.toEqual({ connection: { type: 'oauth', accessToken: 'jira-token' }, issueId: 'ENG-42' });
    await expect(
      jira.intake.resolveIntakeDispatch!({ orgId: 'org-1', externalSource: { type: 'pull-request', externalId: '1' } }),
    ).resolves.toBeNull();
  });

  it('surfaces auth failures as jira_auth_failed infrastructure errors', async () => {
    stubRoutes([['POST', '/rest/api/3/search/jql', () => jsonResponse({ errorMessages: ['Unauthorized'] }, 401)]]);

    const failure = integration().intake.listIssues({ connection, sourceIds: ['1'] });
    await expect(failure).rejects.toBeInstanceOf(JiraApiError);
    await expect(failure).rejects.toMatchObject({ code: 'jira_auth_failed', status: 401 });
  });
});

describe('JiraIntegration diagnostics', () => {
  it('reports the site and a masked email, never secret values', () => {
    const snapshot = integration().diagnostics();
    expect(snapshot).toEqual({ configured: true, site: 'acme.atlassian.net', email: 'o***@acme.test' });
    expect(JSON.stringify(snapshot)).not.toContain('jira-token');
  });
});
