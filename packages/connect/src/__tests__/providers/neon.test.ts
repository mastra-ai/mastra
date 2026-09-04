import { afterEach, describe, expect, it, vi } from 'vitest';

import { createNeonTools } from '../../providers/neon.js';

const TOKEN = 'fake-test-token';

const EXPECTED_TOOLS = [
  'neon_list_projects',
  'neon_get_project',
  'neon_list_branches',
  'neon_create_branch',
  'neon_delete_branch',
  'neon_list_databases',
  'neon_list_endpoints',
];

const projectObject = {
  id: 'project-123',
  name: 'my-app',
  region_id: 'aws-us-east-2',
  default_endpoint_settings: { pg_version: '17' },
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

const branchObject = {
  id: 'br-main-1',
  name: 'main',
  parent_id: null,
  default: true,
  current_state: 'ready',
  logical_size: 33554432,
  created_at: '2026-08-01T00:00:00Z',
};

function makeTools(fetchMock: ReturnType<typeof vi.fn>, options?: Parameters<typeof createNeonTools>[0]) {
  return createNeonTools({
    connectionId: 'c_neon1',
    client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    ...options,
  });
}

interface ExecutableTool {
  id: string;
  execute: (input: unknown, context: unknown) => Promise<unknown>;
}

function tool(tools: ReturnType<typeof createNeonTools>, key: string): ExecutableTool {
  expect(tools[key]).toBeDefined();
  return tools[key] as unknown as ExecutableTool;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createNeonTools', () => {
  it('returns the full curated toolset', () => {
    expect(Object.keys(createNeonTools()).sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it('filters with allowTools and throws on unknown names', () => {
    const tools = createNeonTools({ allowTools: ['neon_list_projects'] });
    expect(Object.keys(tools)).toEqual(['neon_list_projects']);
    expect(() => createNeonTools({ allowTools: ['neon_nope'] })).toThrow(/neon_nope/);
  });

  it('GETs v2/projects and shapes the projects envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ projects: [projectObject] }));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'neon_list_projects').execute({ search: 'my' }, {} as never);
    expect(result).toEqual({
      projects: [
        {
          id: 'project-123',
          name: 'my-app',
          regionId: 'aws-us-east-2',
          pgVersion: '17',
          createdAt: '2026-08-01T00:00:00Z',
          updatedAt: '2026-09-01T00:00:00Z',
        },
      ],
    });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_neon1/proxy/v2/projects?search=my');
  });

  it('unwraps the single-project envelope in neon_get_project', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ project: projectObject }));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'neon_get_project').execute({ projectId: 'project-123' }, {} as never);
    expect(result).toMatchObject({ id: 'project-123', name: 'my-app', pgVersion: '17' });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_neon1/proxy/v2/projects/project-123');
  });

  it('lists branches of a project', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ branches: [branchObject] }));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'neon_list_branches').execute({ projectId: 'project-123' }, {} as never);
    expect(result).toEqual({
      branches: [
        {
          id: 'br-main-1',
          name: 'main',
          parentId: null,
          default: true,
          currentState: 'ready',
          logicalSize: 33554432,
          createdAt: '2026-08-01T00:00:00Z',
        },
      ],
    });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_neon1/proxy/v2/projects/project-123/branches');
  });

  it('POSTs create_branch with name and parent_id in the branch envelope', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ branch: { ...branchObject, id: 'br-new', name: 'feature-x', parent_id: 'br-main-1' } }),
      );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'neon_create_branch').execute(
      { projectId: 'project-123', name: 'feature-x', parentId: 'br-main-1' },
      {} as never,
    );
    expect(result).toMatchObject({ id: 'br-new', name: 'feature-x', parentId: 'br-main-1' });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ branch: { name: 'feature-x', parent_id: 'br-main-1' } });
  });

  it('DELETEs a branch and reports the deleted branch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ branch: { id: 'br-old', name: 'old' } }));
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'neon_delete_branch').execute(
      { projectId: 'project-123', branchId: 'br-old' },
      {} as never,
    );
    expect(result).toEqual({ branchId: 'br-old', name: 'old' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_neon1/proxy/v2/projects/project-123/branches/br-old');
    expect(init.method).toBe('DELETE');
  });

  it('lists databases per branch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        databases: [{ id: 5, name: 'appdb', owner_name: 'app_role', branch_id: 'br-main-1' }],
      }),
    );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'neon_list_databases').execute(
      { projectId: 'project-123', branchId: 'br-main-1' },
      {} as never,
    );
    expect(result).toEqual({
      databases: [{ id: 5, name: 'appdb', ownerName: 'app_role', branchId: 'br-main-1' }],
    });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      'https://example.test/v2/connections/c_neon1/proxy/v2/projects/project-123/branches/br-main-1/databases',
    );
  });

  it('lists endpoint connection metadata without credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        endpoints: [
          {
            id: 'ep-1',
            branch_id: 'br-main-1',
            host: 'ep-abc123.us-east-2.aws.neon.tech',
            type: 'read_write',
            current_state: 'active',
          },
        ],
      }),
    );
    const tools = makeTools(fetchMock);
    const result = await tool(tools, 'neon_list_endpoints').execute({ projectId: 'project-123' }, {} as never);
    expect(result).toEqual({
      endpoints: [
        {
          id: 'ep-1',
          branchId: 'br-main-1',
          host: 'ep-abc123.us-east-2.aws.neon.tech',
          type: 'read_write',
          currentState: 'active',
        },
      ],
    });
  });

  it('falls back to MASTRA_NEON_CONNECTION_ID and errors when unresolvable', async () => {
    vi.stubEnv('MASTRA_NEON_CONNECTION_ID', 'c_envneon');
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ projects: [] }));
    const tools = createNeonTools({
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    });
    await tool(tools, 'neon_list_projects').execute({}, {} as never);
    expect(fetchMock.mock.calls[0]![0]).toContain('/v2/connections/c_envneon/proxy/');

    vi.stubEnv('MASTRA_NEON_CONNECTION_ID', '');
    const tools2 = createNeonTools({ client: { accessToken: TOKEN, baseUrl: 'https://example.test' } });
    await expect(tool(tools2, 'neon_list_projects').execute({}, {} as never)).rejects.toMatchObject({
      code: 'missing_connection_id',
    });
  });
});
