import { afterEach, describe, expect, it, vi } from 'vitest';

import { MastraConnectError } from '../../errors.js';
import { createLinearTools } from '../../providers/linear.js';

const TOKEN = 'fake-test-token';

const EXPECTED_TOOLS = [
  'linear_list_teams',
  'linear_list_issues',
  'linear_get_issue',
  'linear_search_issues',
  'linear_create_issue',
  'linear_update_issue',
  'linear_add_comment',
  'linear_list_projects',
  'linear_list_users',
];

const issueNode = {
  id: 'issue-uuid-1',
  identifier: 'ENG-123',
  title: 'Fix the bug',
  description: 'It is broken',
  priority: 2,
  url: 'https://linear.app/acme/issue/ENG-123',
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-02T00:00:00Z',
  state: { id: 's1', name: 'In Progress', type: 'started' },
  assignee: { id: 'u1', name: 'Ada' },
  team: { id: 't1', key: 'ENG', name: 'Engineering' },
};

function makeTools(fetchMock: ReturnType<typeof vi.fn>, options?: Parameters<typeof createLinearTools>[0]) {
  return createLinearTools({
    connectionId: 'c_lin1',
    client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    ...options,
  });
}

interface ExecutableTool {
  id: string;
  execute: (input: unknown, context: unknown) => Promise<unknown>;
}

function tool(tools: ReturnType<typeof createLinearTools>, key: string): ExecutableTool {
  expect(tools[key]).toBeDefined();
  return tools[key] as unknown as ExecutableTool;
}

function graphqlOk(data: unknown) {
  return Response.json({ data });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createLinearTools', () => {
  it('returns the full curated toolset', () => {
    expect(Object.keys(createLinearTools()).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it('filters with allowTools and throws on unknown names', () => {
    const tools = createLinearTools({ allowTools: ['linear_list_teams', 'linear_get_issue'] });
    expect(Object.keys(tools)).toEqual(['linear_list_teams', 'linear_get_issue']);
    expect(() => createLinearTools({ allowTools: ['linear_nope'] })).toThrow(/linear_nope/);
  });

  it('POSTs a teams query to the proxy graphql path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      graphqlOk({
        teams: {
          nodes: [{ id: 't1', key: 'ENG', name: 'Engineering' }],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      }),
    );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'linear_list_teams').execute({}, {} as never);
    expect(result).toEqual({
      teams: [{ id: 't1', key: 'ENG', name: 'Engineering' }],
      pageInfo: { hasNextPage: false, endCursor: null },
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_lin1/proxy/graphql');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.query).toContain('teams(first: $first');
    expect(body.variables).toEqual({ first: 25, after: null });
  });

  it('caps pagination at 50 via the input schema', async () => {
    const fetchMock = vi.fn();
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'linear_list_teams').execute({ limit: 999 }, {} as never);
    // createTool validates input and returns a validation error object instead of calling execute
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ error: true });
  });

  it('sends the issue create mutation and shapes the result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(graphqlOk({ issueCreate: { success: true, issue: issueNode } }));
    const tools = makeTools(fetchMock);
    const result = (await tool(tools, 'linear_create_issue').execute(
      { teamId: 't1', title: 'Fix the bug', priority: 2 },
      {} as never,
    )) as { issue: { identifier: string } };
    expect(result.issue.identifier).toBe('ENG-123');
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.query).toContain('issueCreate');
    expect(body.variables.input).toMatchObject({ teamId: 't1', title: 'Fix the bug', priority: 2 });
  });

  it('builds issue filters from teamKey/assigneeEmail/stateName', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        graphqlOk({ issues: { nodes: [issueNode], pageInfo: { hasNextPage: true, endCursor: 'cur1' } } }),
      );
    const tools = makeTools(fetchMock);
    const result = (await tool(tools, 'linear_list_issues').execute(
      { teamKey: 'ENG', stateName: 'In Progress', limit: 10 },
      {} as never,
    )) as { issues: unknown[]; pageInfo: { endCursor: string | null } };
    expect(result.issues).toHaveLength(1);
    expect(result.pageInfo.endCursor).toBe('cur1');
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.variables.filter).toEqual({ team: { key: { eq: 'ENG' } }, state: { name: { eq: 'In Progress' } } });
    expect(body.variables.first).toBe(10);
  });

  it('sends the issue update mutation with id outside the input payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(graphqlOk({ issueUpdate: { success: true, issue: issueNode } }));
    const tools = makeTools(fetchMock);
    const result = (await tool(tools, 'linear_update_issue').execute(
      { id: 'issue-uuid-1', title: 'New title', stateId: 's2' },
      {} as never,
    )) as { issue: { identifier: string } };
    expect(result.issue.identifier).toBe('ENG-123');
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.query).toContain('issueUpdate');
    expect(body.variables.id).toBe('issue-uuid-1');
    expect(body.variables.input).toMatchObject({ title: 'New title', stateId: 's2' });
    expect(body.variables.input).not.toHaveProperty('id');
  });

  it('maps search query to the searchIssues term variable', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        graphqlOk({ searchIssues: { nodes: [issueNode], pageInfo: { hasNextPage: false, endCursor: null } } }),
      );
    const tools = makeTools(fetchMock);
    const result = (await tool(tools, 'linear_search_issues').execute({ query: 'broken login' }, {} as never)) as {
      issues: { identifier: string }[];
    };
    expect(result.issues[0]!.identifier).toBe('ENG-123');
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.query).toContain('searchIssues');
    expect(body.variables.term).toBe('broken login');
  });

  it('shapes projects and users list results', async () => {
    const projectsFetch = vi.fn().mockResolvedValue(
      graphqlOk({
        projects: {
          nodes: [{ id: 'p1', name: 'Launch', state: 'started', url: 'https://linear.app/acme/project/p1' }],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      }),
    );
    await expect(tool(makeTools(projectsFetch), 'linear_list_projects').execute({}, {} as never)).resolves.toEqual({
      projects: [{ id: 'p1', name: 'Launch', state: 'started', url: 'https://linear.app/acme/project/p1' }],
      pageInfo: { hasNextPage: false, endCursor: null },
    });

    const usersFetch = vi.fn().mockResolvedValue(
      graphqlOk({
        users: {
          nodes: [{ id: 'u1', name: 'Ada', email: 'ada@acme.test', active: true }],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      }),
    );
    await expect(tool(makeTools(usersFetch), 'linear_list_users').execute({}, {} as never)).resolves.toEqual({
      users: [{ id: 'u1', name: 'Ada', email: 'ada@acme.test', active: true }],
      pageInfo: { hasNextPage: false, endCursor: null },
    });
  });

  it('throws proxy_error for GraphQL errors in a 200 response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ errors: [{ message: 'Field "nope" does not exist' }] }));
    const tools = makeTools(fetchMock);
    try {
      await tool(tools, 'linear_get_issue').execute({ id: 'ENG-123' }, {} as never);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MastraConnectError);
      expect((error as MastraConnectError).code).toBe('proxy_error');
      expect((error as Error).message).toContain('Field "nope" does not exist');
    }
  });

  it('throws proxy_error when linear_get_issue finds nothing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(graphqlOk({ issue: null }));
    const tools = makeTools(fetchMock);
    await expect(tool(tools, 'linear_get_issue').execute({ id: 'ENG-999' }, {} as never)).rejects.toMatchObject({
      code: 'proxy_error',
    });
  });

  it('falls back to MASTRA_LINEAR_CONNECTION_ID at execute time', async () => {
    vi.stubEnv('MASTRA_LINEAR_CONNECTION_ID', 'c_env9');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(graphqlOk({ teams: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } }));
    const tools = createLinearTools({
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    });
    await tool(tools, 'linear_list_teams').execute({}, {} as never);
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/v2/connections/c_env9/proxy/graphql');
  });

  it('throws missing_connection_id at execute time when unresolvable', async () => {
    vi.stubEnv('MASTRA_LINEAR_CONNECTION_ID', '');
    const fetchMock = vi.fn();
    const tools = createLinearTools({
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    });
    await expect(tool(tools, 'linear_list_teams').execute({}, {} as never)).rejects.toMatchObject({
      code: 'missing_connection_id',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('adds a comment through the commentCreate mutation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      graphqlOk({
        commentCreate: {
          success: true,
          comment: { id: 'cm1', body: 'Nice', url: 'https://linear.app/acme/comment/cm1' },
        },
      }),
    );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'linear_add_comment').execute(
      { issueId: 'issue-uuid-1', body: 'Nice' },
      {} as never,
    );
    expect(result).toEqual({
      comment: { id: 'cm1', body: 'Nice', url: 'https://linear.app/acme/comment/cm1' },
    });
  });
});
