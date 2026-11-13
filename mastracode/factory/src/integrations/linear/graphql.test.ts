import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  collectIssueComments,
  createComment,
  getIssue,
  getViewer,
  isLinearNotFound,
  isLinearRateLimited,
  LinearGraphqlError,
  linearHttpTransport,
  listAllProjects,
  listAllTeams,
  listIssues,
  listWorkflowStates,
  resolveIssueId,
  updateIssueState,
} from './graphql.js';
import type { LinearGraphqlTransport } from './graphql.js';

type Call = { query: string; variables: Record<string, unknown> };

/** A transport that records each request and answers from `replies` in order. */
function fakeTransport(...replies: unknown[]): LinearGraphqlTransport & { calls: Call[] } {
  const calls: Call[] = [];
  const transport = async (query: string, variables: Record<string, unknown>) => {
    calls.push({ query, variables });
    if (replies.length === 0) throw new Error(`Unexpected Linear request: ${query}`);
    return replies.shift();
  };
  return Object.assign(transport, { calls });
}

const user = { id: 'user-1', name: 'Ada', displayName: 'ada', email: 'ada@acme.dev', avatarUrl: null };
const issueNode = {
  id: 'issue-1',
  identifier: 'ENG-42',
  number: 42,
  title: 'Fix intake',
  description: 'Body',
  url: 'https://linear.app/acme/issue/ENG-42',
  priority: 2,
  priorityLabel: 'High',
  labels: { nodes: [{ id: 'label-1', name: 'bug' }] },
  state: { id: 'state-1', name: 'Todo', type: 'unstarted' },
  team: { id: 'team-1', key: 'ENG', name: 'Engineering' },
  project: { id: 'project-1' },
  assignee: user,
  creator: null,
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
  archivedAt: null,
};
const mappedIssue = { ...issueNode, labels: [{ id: 'label-1', name: 'bug' }] };
const comment = (id: string) => ({
  id,
  body: `comment ${id}`,
  url: `https://linear.app/acme/issue/ENG-42#comment-${id}`,
  issue: { id: 'issue-1', identifier: 'ENG-42' },
  user,
  parent: null,
  createdAt: '2026-07-03T00:00:00Z',
  updatedAt: '2026-07-03T00:00:00Z',
});
const lastPage = { hasNextPage: false, endCursor: null };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Linear GraphQL operations', () => {
  it('reads the viewer as the app user and the workspace it belongs to', async () => {
    const transport = fakeTransport({
      data: { viewer: { id: 'app-user', organization: { id: 'org-1', name: 'Acme', urlKey: 'acme' } } },
    });

    await expect(getViewer(transport)).resolves.toEqual({
      appUserId: 'app-user',
      workspace: { id: 'org-1', name: 'Acme', urlKey: 'acme' },
    });
    expect(transport.calls[0]!.query).toContain('viewer { id organization { id name urlKey } }');
  });

  it('lists active issues with each filter as a variable, flattening labels', async () => {
    const transport = fakeTransport({ data: { issues: { nodes: [issueNode], pageInfo: lastPage } } });

    const page = await listIssues(transport, {
      first: 30,
      after: 'cursor-1',
      projectIds: ['project-1'],
      labels: ['bug'],
    });

    expect(page).toEqual({ nodes: [mappedIssue], pageInfo: lastPage });
    const { query, variables } = transport.calls[0]!;
    expect(query).toContain('query Intake(');
    expect(query).toContain('state: { type: { in: $stateTypes } }');
    expect(query).toContain('project: { id: { in: $projectIds } }');
    expect(query).toContain('labels: { name: { in: $labels } }');
    expect(query).not.toContain('$teamIds');
    expect(variables).toEqual({
      first: 30,
      after: 'cursor-1',
      stateTypes: ['triage', 'backlog', 'unstarted', 'started'],
      projectIds: ['project-1'],
      labels: ['bug'],
    });
  });

  it('filters issues by team without a project filter', async () => {
    const transport = fakeTransport({ data: { issues: { nodes: [], pageInfo: lastPage } } });

    await listIssues(transport, { first: 30, teamIds: ['team-1'], stateTypes: ['started'] });

    const { query, variables } = transport.calls[0]!;
    expect(query).toContain('team: { id: { in: $teamIds } }');
    expect(query).not.toContain('$projectIds');
    expect(query).not.toContain('$labels');
    expect(variables).toEqual({ first: 30, after: null, stateTypes: ['started'], teamIds: ['team-1'] });
  });

  it('rejects an issue page that hands back the cursor it was asked for', async () => {
    const transport = fakeTransport({
      data: { issues: { nodes: [], pageInfo: { hasNextPage: true, endCursor: 'cursor-1' } } },
    });

    await expect(listIssues(transport, { first: 30, after: 'cursor-1' })).rejects.toMatchObject({
      code: 'invalid_cursor',
    });
  });

  it('reads an issue with its first comment page by id or identifier', async () => {
    const transport = fakeTransport({
      data: {
        issue: {
          ...issueNode,
          comments: { nodes: [comment('c1')], pageInfo: { hasNextPage: true, endCursor: 'c-cursor' } },
        },
      },
    });

    await expect(getIssue(transport, 'ENG-42', { commentsFirst: 50 })).resolves.toEqual({
      ...mappedIssue,
      comments: { nodes: [comment('c1')], pageInfo: { hasNextPage: true, endCursor: 'c-cursor' } },
    });
    expect(transport.calls[0]!.query).toContain('query IssueDetail(');
    expect(transport.calls[0]!.variables).toEqual({ id: 'ENG-42', commentsFirst: 50 });
  });

  it('reads a missing issue as null, whether Linear says "Entity not found" or returns no node', async () => {
    const notFound = fakeTransport({
      errors: [{ message: 'Entity not found: Issue', extensions: { code: 'ENTITY_NOT_FOUND' } }],
    });
    await expect(getIssue(notFound, 'ENG-404', { commentsFirst: 50 })).resolves.toBeNull();
    await expect(
      getIssue(fakeTransport({ data: { issue: null } }), 'ENG-404', { commentsFirst: 50 }),
    ).resolves.toBeNull();
    await expect(
      resolveIssueId(fakeTransport({ errors: [{ message: 'Entity not found' }] }), 'ENG-404'),
    ).resolves.toBeNull();
  });

  it('follows comment pages until the last one, from the page the issue read returned', async () => {
    const transport = fakeTransport(
      { data: { issue: { comments: { nodes: [comment('c2')], pageInfo: { hasNextPage: true, endCursor: 'p2' } } } } },
      { data: { issue: { comments: { nodes: [comment('c3')], pageInfo: lastPage } } } },
    );

    const comments = await collectIssueComments(
      transport,
      'issue-1',
      { nodes: [comment('c1')], pageInfo: { hasNextPage: true, endCursor: 'p1' } },
      { pageSize: 50, maxPages: 20 },
    );

    expect(comments.map(c => c.id)).toEqual(['c1', 'c2', 'c3']);
    expect(transport.calls.map(call => call.variables)).toEqual([
      { id: 'issue-1', first: 50, after: 'p1' },
      { id: 'issue-1', first: 50, after: 'p2' },
    ]);
    expect(transport.calls[0]!.query).toContain('query IssueComments(');
  });

  it('stops following comment pages at maxPages, counting the first page', async () => {
    const more = (cursor: string) => ({
      data: { issue: { comments: { nodes: [comment(cursor)], pageInfo: { hasNextPage: true, endCursor: cursor } } } },
    });
    const transport = fakeTransport(more('p2'), more('p3'));

    const comments = await collectIssueComments(
      transport,
      'issue-1',
      { nodes: [comment('p1')], pageInfo: { hasNextPage: true, endCursor: 'p1' } },
      { pageSize: 50, maxPages: 3 },
    );

    expect(comments.map(c => c.id)).toEqual(['p1', 'p2', 'p3']);
    expect(transport.calls).toHaveLength(2);
  });

  it('pages through every project and team, and refuses a cursor that repeats', async () => {
    const projects = fakeTransport(
      {
        data: {
          projects: {
            nodes: [
              { id: 'p1', name: 'One', state: 'started', teams: { nodes: [{ id: 't1', key: 'ENG', name: 'Eng' }] } },
            ],
            pageInfo: { hasNextPage: true, endCursor: 'next' },
          },
        },
      },
      {
        data: {
          projects: { nodes: [{ id: 'p2', name: 'Two', state: 'planned', teams: { nodes: [] } }], pageInfo: lastPage },
        },
      },
    );
    await expect(listAllProjects(projects, { pageSize: 100, maxPages: 20 })).resolves.toEqual([
      { id: 'p1', name: 'One', state: 'started', teams: [{ id: 't1', key: 'ENG', name: 'Eng' }] },
      { id: 'p2', name: 'Two', state: 'planned', teams: [] },
    ]);
    expect(projects.calls.map(call => call.variables)).toEqual([{ first: 100 }, { first: 100, after: 'next' }]);

    const teams = fakeTransport(
      {
        data: {
          teams: { nodes: [{ id: 't1', key: 'ENG', name: 'Eng' }], pageInfo: { hasNextPage: true, endCursor: 'a' } },
        },
      },
      { data: { teams: { nodes: [], pageInfo: { hasNextPage: true, endCursor: 'a' } } } },
    );
    await expect(listAllTeams(teams, { pageSize: 100, maxPages: 20 })).rejects.toMatchObject({
      code: 'invalid_cursor',
    });
  });

  it('stops listing teams at maxPages', async () => {
    const page = (cursor: string) => ({
      data: {
        teams: {
          nodes: [{ id: cursor, key: cursor, name: cursor }],
          pageInfo: { hasNextPage: true, endCursor: cursor },
        },
      },
    });
    const transport = fakeTransport(page('a'), page('b'));

    await expect(listAllTeams(transport, { pageSize: 100, maxPages: 2 })).resolves.toHaveLength(2);
    expect(transport.calls).toHaveLength(2);
  });

  it("lists a team's workflow states, stamped with the team id", async () => {
    const transport = fakeTransport({
      data: {
        team: { id: 'team-uuid', states: { nodes: [{ id: 's1', name: 'Done', type: 'completed', position: 3 }] } },
      },
    });

    await expect(listWorkflowStates(transport, 'ENG')).resolves.toEqual([
      { id: 's1', name: 'Done', type: 'completed', position: 3, teamId: 'team-uuid' },
    ]);
    expect(transport.calls[0]!.variables).toEqual({ teamId: 'ENG' });
    await expect(listWorkflowStates(fakeTransport({ data: { team: null } }), 'GONE')).resolves.toEqual([]);
  });

  it('creates a comment and moves an issue, failing when Linear refuses', async () => {
    const transport = fakeTransport(
      { data: { commentCreate: { success: true, comment: comment('new') } } },
      { data: { issueUpdate: { success: true } } },
      { data: { commentCreate: { success: false, comment: null } } },
      { data: { issueUpdate: { success: false } } },
    );

    await expect(createComment(transport, { issueId: 'issue-1', body: 'Done' })).resolves.toEqual(comment('new'));
    await expect(updateIssueState(transport, { issueId: 'issue-1', stateId: 's1' })).resolves.toBeUndefined();
    expect(transport.calls.map(call => call.variables)).toEqual([
      { input: { issueId: 'issue-1', body: 'Done' } },
      { id: 'issue-1', stateId: 's1' },
    ]);
    await expect(createComment(transport, { issueId: 'issue-1', body: 'x' })).rejects.toThrow(
      'Linear did not accept the comment.',
    );
    await expect(updateIssueState(transport, { issueId: 'issue-1', stateId: 's1' })).rejects.toThrow(
      'Linear did not accept the issue update.',
    );
  });
});

describe('Linear GraphQL errors', () => {
  it('maps errors[] to a typed error carrying the extension code', async () => {
    const transport = fakeTransport({
      errors: [{ message: 'Rate limit exceeded', extensions: { code: 'RATELIMITED' } }],
    });

    const error = await getViewer(transport).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(LinearGraphqlError);
    expect(error).toMatchObject({ message: 'Linear API error: Rate limit exceeded', code: 'RATELIMITED' });
    expect(isLinearRateLimited(error)).toBe(true);
    expect(isLinearNotFound(error)).toBe(false);
  });

  it('fails on a response with neither data nor errors', async () => {
    await expect(getViewer(fakeTransport({}))).rejects.toThrow('Linear API returned no data.');
  });

  it('sends the token to Linear and maps a failed HTTP request to its status, code and Retry-After', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ errors: [{ message: 'Too many requests', extensions: { code: 'RATELIMITED' } }] }),
          {
            status: 429,
            headers: { 'content-type': 'application/json', 'retry-after': '30' },
          },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await getViewer(linearHttpTransport('token-1')).catch((err: unknown) => err);

    expect(error).toMatchObject({
      message: 'Linear API request failed (429): Too many requests',
      status: 429,
      code: 'RATELIMITED',
      retryAfterSeconds: 30,
    });
    expect(isLinearRateLimited(error)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.linear.app/graphql');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token-1');
  });

  it('keeps the bare status when a failed request has no JSON body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('bad gateway', { status: 502 })),
    );

    await expect(getViewer(linearHttpTransport('token-1'))).rejects.toMatchObject({
      message: 'Linear API request failed (502)',
      status: 502,
    });
  });
});
