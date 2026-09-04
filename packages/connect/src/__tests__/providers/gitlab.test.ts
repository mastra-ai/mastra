import { afterEach, describe, expect, it, vi } from 'vitest';

import { createGitlabTools } from '../../providers/gitlab.js';

const TOKEN = 'fake-test-token';

const EXPECTED_TOOLS = [
  'gitlab_list_projects',
  'gitlab_get_project',
  'gitlab_list_issues',
  'gitlab_create_issue',
  'gitlab_update_issue',
  'gitlab_list_merge_requests',
  'gitlab_get_merge_request',
  'gitlab_create_mr_note',
  'gitlab_get_file',
  'gitlab_list_pipelines',
];

const projectObject = {
  id: 42,
  path_with_namespace: 'acme/widgets',
  name: 'widgets',
  web_url: 'https://gitlab.com/acme/widgets',
  default_branch: 'main',
  description: 'Widget service',
};

const issueObject = {
  iid: 7,
  title: 'Crash on boot',
  state: 'opened',
  web_url: 'https://gitlab.com/acme/widgets/-/issues/7',
  labels: ['bug', 'p1'],
  updated_at: '2026-09-01T10:00:00Z',
};

function makeTools(fetchMock: ReturnType<typeof vi.fn>, options?: Parameters<typeof createGitlabTools>[0]) {
  return createGitlabTools({
    connectionId: 'c_git1',
    client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    ...options,
  });
}

interface ExecutableTool {
  id: string;
  execute: (input: unknown, context: unknown) => Promise<unknown>;
}

function tool(tools: ReturnType<typeof createGitlabTools>, key: string): ExecutableTool {
  expect(tools[key]).toBeDefined();
  return tools[key] as unknown as ExecutableTool;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createGitlabTools', () => {
  it('returns the full curated toolset', () => {
    expect(Object.keys(createGitlabTools()).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it('filters with allowTools and throws on unknown names', () => {
    const tools = createGitlabTools({ allowTools: ['gitlab_get_project'] });
    expect(Object.keys(tools)).toEqual(['gitlab_get_project']);
    expect(() => createGitlabTools({ allowTools: ['gitlab_nope'] })).toThrow(/gitlab_nope/);
  });

  it('GETs api/v4/projects with membership=true and shapes the array', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([projectObject]));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'gitlab_list_projects').execute({ page: 2, perPage: 10 }, {} as never);
    expect(result).toEqual({
      projects: [
        {
          id: 42,
          pathWithNamespace: 'acme/widgets',
          name: 'widgets',
          webUrl: 'https://gitlab.com/acme/widgets',
          defaultBranch: 'main',
          description: 'Widget service',
        },
      ],
      page: 2,
      perPage: 10,
    });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      'https://example.test/v2/connections/c_git1/proxy/api/v4/projects?membership=true&page=2&per_page=10',
    );
  });

  it('URL-encodes a group/project path in gitlab_get_project', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(projectObject));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'gitlab_get_project').execute({ projectId: 'acme/widgets' }, {} as never);
    expect(result.id).toBe(42);
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_git1/proxy/api/v4/projects/acme%2Fwidgets');
  });

  it('lists issues with the default opened state', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([issueObject]));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'gitlab_list_issues').execute({ projectId: '42' }, {} as never);
    expect(result).toMatchObject({
      issues: [{ iid: 7, title: 'Crash on boot', state: 'opened', labels: ['bug', 'p1'] }],
    });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_git1/proxy/api/v4/projects/42/issues?state=opened');
  });

  it('POSTs create_issue with labels joined as CSV', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(issueObject));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'gitlab_create_issue').execute(
      { projectId: 'acme/widgets', title: 'Crash on boot', description: 'Repro steps…', labels: ['bug', 'p1'] },
      {} as never,
    );
    expect(result).toMatchObject({ iid: 7, title: 'Crash on boot' });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ title: 'Crash on boot', description: 'Repro steps…', labels: 'bug,p1' });
  });

  it('rejects a no-op gitlab_update_issue without calling fetch', async () => {
    const fetchMock = vi.fn();
    const tools = makeTools(fetchMock);
    const rejected = await tool(tools, 'gitlab_update_issue').execute({ projectId: '42', issueIid: 7 }, {} as never);
    expect(rejected).toMatchObject({ error: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('PUTs update_issue with state_event', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ ...issueObject, state: 'closed' }));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'gitlab_update_issue').execute(
      { projectId: '42', issueIid: 7, stateEvent: 'close' },
      {} as never,
    );
    expect(result).toMatchObject({ state: 'closed' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_git1/proxy/api/v4/projects/42/issues/7');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({
      title: undefined,
      description: undefined,
      labels: undefined,
      state_event: 'close',
    });
  });

  it('URL-encodes the file path and decodes base64 content in gitlab_get_file', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        file_name: 'index.ts',
        file_path: 'src/index.ts',
        ref: 'main',
        size: 11,
        encoding: 'base64',
        content: Buffer.from('hello world').toString('base64'),
      }),
    );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'gitlab_get_file').execute(
      { projectId: '42', filePath: 'src/index.ts', ref: 'main' },
      {} as never,
    );
    expect(result).toEqual({
      fileName: 'index.ts',
      filePath: 'src/index.ts',
      ref: 'main',
      size: 11,
      encoding: 'base64',
      text: 'hello world',
    });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      'https://example.test/v2/connections/c_git1/proxy/api/v4/projects/42/repository/files/src%2Findex.ts?ref=main',
    );
  });

  it('POSTs an MR note and shapes the author', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ id: 99, body: 'LGTM', created_at: '2026-09-02T12:00:00Z', author: { name: 'Ada' } }),
      );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'gitlab_create_mr_note').execute(
      { projectId: 'acme/widgets', mergeRequestIid: 3, body: 'LGTM' },
      {} as never,
    );
    expect(result).toEqual({ id: 99, body: 'LGTM', createdAt: '2026-09-02T12:00:00Z', authorName: 'Ada' });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      'https://example.test/v2/connections/c_git1/proxy/api/v4/projects/acme%2Fwidgets/merge_requests/3/notes',
    );
  });

  it('lists pipelines with optional status filter', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json([
          {
            id: 501,
            status: 'running',
            ref: 'main',
            web_url: 'https://gitlab.com/p/501',
            created_at: '2026-09-03T00:00:00Z',
          },
        ]),
      );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'gitlab_list_pipelines').execute(
      { projectId: '42', status: 'running' },
      {} as never,
    );
    expect(result).toMatchObject({ pipelines: [{ id: 501, status: 'running', ref: 'main' }] });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_git1/proxy/api/v4/projects/42/pipelines?status=running');
  });

  it('falls back to MASTRA_GITLAB_CONNECTION_ID and errors when unresolvable', async () => {
    vi.stubEnv('MASTRA_GITLAB_CONNECTION_ID', 'c_envgit');
    const fetchMock = vi.fn().mockResolvedValue(Response.json([]));
    const tools = createGitlabTools({
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    });
    await tool(tools, 'gitlab_list_projects').execute({}, {} as never);
    expect(fetchMock.mock.calls[0]![0]).toContain('/v2/connections/c_envgit/proxy/');

    vi.stubEnv('MASTRA_GITLAB_CONNECTION_ID', '');
    const tools2 = createGitlabTools({ client: { accessToken: TOKEN, baseUrl: 'https://example.test' } });
    await expect(tool(tools2, 'gitlab_list_projects').execute({}, {} as never)).rejects.toMatchObject({
      code: 'missing_connection_id',
    });
  });
});
