import { afterEach, describe, expect, it, vi } from 'vitest';

import { createJiraTools } from '../../providers/jira.js';

const TOKEN = 'fake-test-token';
const CLOUD_ID = 'cloud-uuid-1';

const EXPECTED_TOOLS = [
  'jira_get_accessible_resources',
  'jira_search_issues',
  'jira_get_issue',
  'jira_create_issue',
  'jira_update_issue',
  'jira_transition_issue',
  'jira_list_transitions',
  'jira_add_comment',
  'jira_list_comments',
  'jira_list_projects',
];

const issueObject = {
  id: '10001',
  key: 'ENG-123',
  fields: {
    summary: 'Fix the bug',
    status: { name: 'In Progress' },
    assignee: { displayName: 'Ada' },
    priority: { name: 'High' },
    issuetype: { name: 'Bug' },
    created: '2026-09-01T00:00:00.000+0000',
    updated: '2026-09-02T00:00:00.000+0000',
  },
};

const shapedIssue = {
  id: '10001',
  key: 'ENG-123',
  summary: 'Fix the bug',
  status: 'In Progress',
  assignee: 'Ada',
  priority: 'High',
  issueType: 'Bug',
  created: '2026-09-01T00:00:00.000+0000',
  updated: '2026-09-02T00:00:00.000+0000',
};

function makeTools(fetchMock: ReturnType<typeof vi.fn>, options?: Parameters<typeof createJiraTools>[0]) {
  return createJiraTools({
    connectionId: 'c_jir1',
    client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    ...options,
  });
}

interface ExecutableTool {
  id: string;
  execute: (input: unknown, context: unknown) => Promise<unknown>;
}

function tool(tools: ReturnType<typeof createJiraTools>, key: string): ExecutableTool {
  expect(tools[key]).toBeDefined();
  return tools[key] as unknown as ExecutableTool;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createJiraTools', () => {
  it('returns the full curated toolset', () => {
    expect(Object.keys(createJiraTools()).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it('filters with allowTools and throws on unknown names', () => {
    const tools = createJiraTools({ allowTools: ['jira_get_issue'] });
    expect(Object.keys(tools)).toEqual(['jira_get_issue']);
    expect(() => createJiraTools({ allowTools: ['jira_nope'] })).toThrow(/jira_nope/);
  });

  it('discovers accessible resources without a cloud id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json([{ id: CLOUD_ID, name: 'Acme', url: 'https://acme.atlassian.net', scopes: [] }]),
      );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'jira_get_accessible_resources').execute({}, {} as never);
    expect(result).toEqual({ sites: [{ cloudId: CLOUD_ID, name: 'Acme', url: 'https://acme.atlassian.net' }] });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_jir1/proxy/oauth/token/accessible-resources');
  });

  it('searches issues via POST search/jql under the ex/jira/{cloudId} prefix', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ issues: [issueObject], nextPageToken: 'tok1' }));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'jira_search_issues').execute(
      { cloudId: CLOUD_ID, jql: 'project = ENG', limit: 10 },
      {} as never,
    );
    expect(result).toEqual({ issues: [shapedIssue], nextPageToken: 'tok1' });
    const [url, init] = fetchMock.mock.calls[0]!;
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe(`/v2/connections/c_jir1/proxy/ex/jira/${CLOUD_ID}/rest/api/3/search/jql`);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.jql).toBe('project = ENG');
    expect(body.maxResults).toBe(10);
    expect(body.fields).toContain('summary');
  });

  it('gets an issue and flattens its ADF description to plain text', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        ...issueObject,
        fields: {
          ...issueObject.fields,
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'It is ' },
                  { type: 'text', text: 'broken.' },
                ],
              },
              { type: 'paragraph', content: [{ type: 'text', text: 'Badly.' }] },
            ],
          },
        },
      }),
    );
    const tools = makeTools(fetchMock);
    const result = (await tool(tools, 'jira_get_issue').execute(
      { cloudId: CLOUD_ID, issueKey: 'ENG-123' },
      {} as never,
    )) as { issue: { description: string } };
    expect(result.issue.description).toBe('It is broken.\nBadly.');
    const parsed = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(parsed.pathname).toBe(`/v2/connections/c_jir1/proxy/ex/jira/${CLOUD_ID}/rest/api/3/issue/ENG-123`);
  });

  it('creates an issue wrapping the description in ADF', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: '10002', key: 'ENG-124' }));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'jira_create_issue').execute(
      { cloudId: CLOUD_ID, projectKey: 'ENG', summary: 'New task', issueType: 'Task', description: 'Do the thing' },
      {} as never,
    );
    expect(result).toEqual({ issue: { id: '10002', key: 'ENG-124' } });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain(`/proxy/ex/jira/${CLOUD_ID}/rest/api/3/issue`);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.fields.project).toEqual({ key: 'ENG' });
    expect(body.fields.issuetype).toEqual({ name: 'Task' });
    expect(body.fields.description).toEqual({
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Do the thing' }] }],
    });
  });

  it('updates an issue via PUT and reports updated on an empty 204', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'jira_update_issue').execute(
      { cloudId: CLOUD_ID, issueKey: 'ENG-123', summary: 'Renamed' },
      {} as never,
    );
    expect(result).toEqual({ updated: true });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body).fields.summary).toBe('Renamed');
  });

  it('rejects an update_issue call with no fields to change', async () => {
    const fetchMock = vi.fn();
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'jira_update_issue').execute(
      { cloudId: CLOUD_ID, issueKey: 'ENG-123' },
      {} as never,
    );
    const emptyString = await tool(tools, 'jira_update_issue').execute(
      { cloudId: CLOUD_ID, issueKey: 'ENG-123', summary: '' },
      {} as never,
    );
    expect(result).toMatchObject({ error: true });
    expect(emptyString).toMatchObject({ error: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lists transitions with their target statuses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ transitions: [{ id: '31', name: 'Done', to: { name: 'Done' } }] }));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'jira_list_transitions').execute(
      { cloudId: CLOUD_ID, issueKey: 'ENG-123' },
      {} as never,
    );
    expect(result).toEqual({ transitions: [{ id: '31', name: 'Done', toStatus: 'Done' }] });
  });

  it('POSTs a transition id to move an issue', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'jira_transition_issue').execute(
      { cloudId: CLOUD_ID, issueKey: 'ENG-123', transitionId: '31' },
      {} as never,
    );
    expect(result).toEqual({ transitioned: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/rest/api/3/issue/ENG-123/transitions');
    expect(JSON.parse(init.body)).toEqual({ transition: { id: '31' } });
  });

  it('adds a comment as ADF and lists comments back as plain text', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ id: 'cm-1', created: '2026-09-03T00:00:00.000+0000' }))
      .mockResolvedValueOnce(
        Response.json({
          comments: [
            {
              id: 'cm-1',
              author: { displayName: 'Ada' },
              body: {
                type: 'doc',
                version: 1,
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'LGTM' }] }],
              },
              created: '2026-09-03T00:00:00.000+0000',
            },
          ],
          total: 1,
        }),
      );
    const tools = makeTools(fetchMock);
    const added = await tool(tools, 'jira_add_comment').execute(
      { cloudId: CLOUD_ID, issueKey: 'ENG-123', body: 'LGTM' },
      {} as never,
    );
    expect(added).toEqual({ comment: { id: 'cm-1', created: '2026-09-03T00:00:00.000+0000' } });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).body.content[0].content[0].text).toBe('LGTM');

    const listed = await tool(tools, 'jira_list_comments').execute(
      { cloudId: CLOUD_ID, issueKey: 'ENG-123' },
      {} as never,
    );
    expect(listed).toEqual({
      comments: [{ id: 'cm-1', author: 'Ada', body: 'LGTM', created: '2026-09-03T00:00:00.000+0000' }],
      total: 1,
    });
  });

  it('lists projects from project/search values', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ values: [{ id: '9', key: 'ENG', name: 'Engineering' }], total: 1, isLast: true }),
      );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'jira_list_projects').execute({ cloudId: CLOUD_ID, query: 'eng' }, {} as never);
    expect(result).toEqual({ projects: [{ id: '9', key: 'ENG', name: 'Engineering' }], total: 1, isLast: true });
    const parsed = new URL(String(fetchMock.mock.calls[0]![0]));
    expect(parsed.pathname).toBe(`/v2/connections/c_jir1/proxy/ex/jira/${CLOUD_ID}/rest/api/3/project/search`);
    expect(parsed.searchParams.get('query')).toBe('eng');
  });

  it('falls back to MASTRA_JIRA_CONNECTION_ID at execute time', async () => {
    vi.stubEnv('MASTRA_JIRA_CONNECTION_ID', 'c_env8');
    const fetchMock = vi.fn().mockResolvedValue(Response.json([]));
    const tools = createJiraTools({
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    });
    await tool(tools, 'jira_get_accessible_resources').execute({}, {} as never);
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/v2/connections/c_env8/proxy/');
  });

  it('throws missing_connection_id when unresolvable', async () => {
    vi.stubEnv('MASTRA_JIRA_CONNECTION_ID', '');
    const tools = createJiraTools({ client: { accessToken: TOKEN, baseUrl: 'https://example.test' } });
    await expect(tool(tools, 'jira_get_accessible_resources').execute({}, {} as never)).rejects.toMatchObject({
      code: 'missing_connection_id',
    });
  });
});
