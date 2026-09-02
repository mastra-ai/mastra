import { afterEach, describe, expect, it, vi } from 'vitest';

import { PlatformApiClient } from '../api-client.js';
import { PlatformJiraApiError } from './api.js';
import {
  decodeIssueReference,
  decodeSourceId,
  encodeIssueReference,
  encodeSourceId,
  PlatformJiraIntegration,
} from './integration.js';

const PLATFORM_BASE = 'https://integrations.example.com';
const connection = { type: 'oauth' as const, accessToken: 'platform-managed' };

const connections = [
  { id: 'a1b_acme', integrationId: 'jira', status: 'active', accountLabel: 'acme.atlassian.net' },
  { id: 'a1b_beta', integrationId: 'jira', status: 'active', accountLabel: 'beta.atlassian.net' },
  { id: 'a1b_gitlab', integrationId: 'gitlab', status: 'active', accountLabel: 'gitlab.com' },
];

function integration(): PlatformJiraIntegration {
  return new PlatformJiraIntegration({
    client: new PlatformApiClient({ baseUrl: PLATFORM_BASE, accessToken: 'platform-token' }),
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function issue(key = 'ENG-42', projectId = '1') {
  return {
    id: `id-${key}`,
    key,
    fields: {
      summary: `Issue ${key}`,
      status: { name: 'To Do', statusCategory: { key: 'new' } },
      assignee: { displayName: 'Ada' },
      reporter: { displayName: 'Grace' },
      labels: ['bug'],
      priority: { name: 'High' },
      project: { id: projectId, key: key.split('-')[0] },
      created: '2026-07-01T00:00:00Z',
      updated: '2026-07-02T00:00:00Z',
    },
  };
}

function stubRoutes(routes: Array<[string, string, () => Response]>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const target = String(input);
    const method = init?.method ?? 'GET';
    if (target.endsWith('/v2/connections')) return json({ connections });
    const match = routes.find(([expectedMethod, path]) => expectedMethod === method && target.includes(path));
    if (!match) throw new Error(`Unexpected request: ${method} ${target}`);
    return match[2]();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('PlatformJiraIntegration over integrations v2', () => {
  it('lists projects from every active Jira connection with site-qualified source ids', async () => {
    stubRoutes([
      [
        'GET',
        'a1b_acme/proxy/rest/api/3/project/search',
        () => json({ values: [{ id: '1', key: 'ENG', name: 'Engineering' }], startAt: 0, isLast: true }),
      ],
      [
        'GET',
        'a1b_beta/proxy/rest/api/3/project/search',
        () => json({ values: [{ id: '2', key: 'OPS', name: 'Operations' }], startAt: 0, isLast: true }),
      ],
    ]);

    const sources = await integration().intake.listSources({ orgId: 'org-1', userId: 'user-1' });

    expect(sources).toHaveLength(2);
    expect(decodeSourceId(sources[0]!.id)).toEqual({ connectionId: 'a1b_acme', projectId: '1' });
    expect(sources[0]).toMatchObject({
      name: 'Engineering',
      metadata: { key: 'ENG', connectionId: 'a1b_acme', site: 'acme.atlassian.net' },
    });
    expect(decodeSourceId(sources[1]!.id)).toEqual({ connectionId: 'a1b_beta', projectId: '2' });
  });

  it('pages selected projects across multiple Jira connections without mixing credentials', async () => {
    const fetchMock = stubRoutes([
      ['POST', 'a1b_acme/proxy/rest/api/3/search/jql', () => json({ issues: [issue('ENG-42', '1')] })],
      ['POST', 'a1b_beta/proxy/rest/api/3/search/jql', () => json({ issues: [issue('OPS-7', '2')] })],
    ]);
    const jira = integration();
    const sourceIds = [encodeSourceId('a1b_acme', '1'), encodeSourceId('a1b_beta', '2')];

    const first = await jira.intake.listItems({ orgId: 'org-1', userId: 'user-1', sourceIds });
    const second = await jira.intake.listItems({
      orgId: 'org-1',
      userId: 'user-1',
      sourceIds,
      cursor: first.nextCursor ?? undefined,
    });

    expect(first.items[0]).toMatchObject({ title: 'ENG-42: Issue ENG-42', metadata: { site: 'acme.atlassian.net' } });
    expect(second.items[0]).toMatchObject({ title: 'OPS-7: Issue OPS-7', metadata: { site: 'beta.atlassian.net' } });
    expect(decodeIssueReference(first.items[0]!.source.externalId)).toEqual({
      connectionId: 'a1b_acme',
      issueId: 'ENG-42',
      projectId: '1',
    });
    const proxyCalls = fetchMock.mock.calls.map(([url]) => String(url)).filter(url => url.includes('/proxy/'));
    expect(proxyCalls[0]).toContain('a1b_acme');
    expect(proxyCalls[1]).toContain('a1b_beta');
  });

  it('sanitizes project and label filters before proxying JQL', async () => {
    const fetchMock = stubRoutes([['POST', '/rest/api/3/search/jql', () => json({ issues: [] })]]);
    await integration().intake.listIssues({
      connection,
      sourceIds: [encodeSourceId('a1b_acme', '1')],
      labels: ['bug', 'ur"gent'],
    });
    const proxyCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/search/jql'))!;
    expect(JSON.parse(String(proxyCall[1]?.body)).jql).toBe(
      'project IN (1) AND statusCategory != Done AND labels IN ("bug", "urgent") ORDER BY updated DESC',
    );
  });

  it('resolves persisted issue references back to their connection and project', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const reference = encodeIssueReference({ connectionId: 'a1b_beta', issueId: 'OPS-7', projectId: '2' });
    await expect(
      integration().intake.resolveIntakeDispatch?.({
        orgId: 'org-1',
        externalSource: { type: 'issue', externalId: reference },
      }),
    ).resolves.toEqual({
      connection: { type: 'oauth', accessToken: 'jira-connection:a1b_beta' },
      sourceId: encodeSourceId('a1b_beta', '2'),
      issueId: 'OPS-7',
    });
  });

  it('fetches issue detail and comments through the connection encoded in the issue reference', async () => {
    stubRoutes([
      ['GET', 'a1b_beta/proxy/rest/api/3/issue/OPS-7?', () => json(issue('OPS-7', '2'))],
      [
        'GET',
        'a1b_beta/proxy/rest/api/3/issue/OPS-7/comment',
        () =>
          json({
            comments: [
              {
                id: 'c1',
                author: { displayName: 'Grace' },
                body: {
                  type: 'doc',
                  version: 1,
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Details' }] }],
                },
                created: '2026-07-03T00:00:00Z',
              },
            ],
            startAt: 0,
            maxResults: 50,
            total: 1,
          }),
      ],
    ]);
    const reference = encodeIssueReference({ connectionId: 'a1b_beta', issueId: 'OPS-7', projectId: '2' });

    const detail = await integration().intake.getIssue({ connection, issueId: reference });

    expect(detail).toMatchObject({
      identifier: 'OPS-7',
      url: 'https://beta.atlassian.net/browse/OPS-7',
      commentCount: 1,
    });
    expect(detail?.comments[0]?.body).toBe('Details');
  });

  it('rejects an unqualified issue key when multiple Jira sites are connected', async () => {
    stubRoutes([]);
    await expect(integration().intake.getIssue({ connection, issueId: 'ENG-42' })).rejects.toMatchObject({
      code: 'jira_request_failed',
      status: 400,
    } satisfies Partial<PlatformJiraApiError>);
  });

  it('creates comments through the selected connection and returns a site URL', async () => {
    stubRoutes([
      [
        'POST',
        'a1b_acme/proxy/rest/api/3/issue/ENG-42/comment',
        () => json({ id: 'c-1', created: '2026-07-03T00:00:00Z' }),
      ],
    ]);
    const result = await integration().intake.createComment({
      connection,
      sourceId: encodeSourceId('a1b_acme', '1'),
      issueId: 'ENG-42',
      body: 'Shipping',
    });
    expect(result).toEqual({
      id: 'c-1',
      url: 'https://acme.atlassian.net/browse/ENG-42?focusedCommentId=c-1',
    });
  });
});
