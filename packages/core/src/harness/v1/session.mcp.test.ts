/**
 * Harness v1 — read-only MCP catalog surface.
 *
 * Covers PF-562's desktop inventory API. The surface snapshots registered
 * MCP server/tool descriptors and does not expose execution or lifecycle
 * controls.
 */

import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { MCPServerBase } from '../../mcp';
import type { MCPServerConfig, MCPServerHonoSSEOptions, MCPServerHTTPOptions, MCPServerSSEOptions } from '../../mcp';
import type { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage/mock';
import type { InternalCoreTool, MCPToolType } from '../../tools';

import { HarnessValidationError } from './errors';
import { Harness } from './harness';

type MockToolListInfo = {
  tools: Array<{
    id?: string;
    name: string;
    description?: string;
    inputSchema: unknown;
    outputSchema?: unknown;
    toolType?: MCPToolType;
    _meta?: Record<string, unknown>;
  }>;
};

class MockMcpServer extends MCPServerBase {
  lastToolListRequestContext?: RequestContext;

  constructor(config: MCPServerConfig) {
    super(config);
  }

  convertTools(tools: Record<string, InternalCoreTool>): Record<string, InternalCoreTool> {
    return tools;
  }

  async startStdio(): Promise<void> {}
  async startSSE(_options: MCPServerSSEOptions): Promise<void> {}
  async startHonoSSE(_options: MCPServerHonoSSEOptions): Promise<Response | undefined> {
    return undefined;
  }
  async startHTTP(_options: MCPServerHTTPOptions): Promise<void> {}
  async close(): Promise<void> {}

  getServerInfo() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      repository: this.repository,
      version_detail: {
        version: this.version,
        release_date: this.releaseDate,
        is_latest: this.isLatest,
      },
    };
  }

  getServerDetail() {
    return {
      ...this.getServerInfo(),
      package_canonical: this.packageCanonical,
      packages: this.packages,
      remotes: this.remotes,
    };
  }

  getToolListInfo(requestContext?: RequestContext): MockToolListInfo | Promise<MockToolListInfo> {
    this.lastToolListRequestContext = requestContext;
    return {
      tools: Object.entries(this.convertedTools).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: tool.parameters,
        outputSchema: tool.outputSchema,
        toolType: tool.mcp?.toolType,
        _meta: tool.mcp?._meta,
      })),
    };
  }

  getToolInfo(toolId: string) {
    const tool = this.convertedTools[toolId];
    if (!tool) return undefined;
    return {
      name: toolId,
      description: tool.description,
      inputSchema: tool.parameters,
      outputSchema: tool.outputSchema,
      toolType: tool.mcp?.toolType,
      _meta: tool.mcp?._meta,
    };
  }

  async executeTool(): Promise<unknown> {
    return {};
  }

  async readResource(): Promise<{ contents: Array<{ uri: string; text?: string; blob?: string }> }> {
    return { contents: [] };
  }

  async listResources(): Promise<{ resources: Array<{ uri: string; name: string }> }> {
    return { resources: [] };
  }
}

class LazyMockMcpServer extends MockMcpServer {
  private readonly lazyTools: MockToolListInfo;
  private readonly hydratedTools?: Record<string, InternalCoreTool>;

  constructor(
    config: Omit<MCPServerConfig, 'tools'>,
    tools: MockToolListInfo['tools'],
    hydratedTools?: Record<string, InternalCoreTool>,
  ) {
    super({ ...config, tools: {} });
    this.lazyTools = { tools };
    this.hydratedTools = hydratedTools;
  }

  getToolListInfo(requestContext?: RequestContext): MockToolListInfo | Promise<MockToolListInfo> {
    this.lastToolListRequestContext = requestContext;
    if (this.hydratedTools) {
      this.convertedTools = this.hydratedTools;
    }
    return Promise.resolve(this.lazyTools);
  }
}

function makeAgent(name = 'default') {
  return new Agent({
    id: name,
    name,
    instructions: 'test',
    model: 'openai/gpt-4o-mini' as any,
  });
}

function makeTool(overrides: Partial<InternalCoreTool> = {}): InternalCoreTool {
  return {
    description: 'Read files',
    parameters: {
      jsonSchema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
        },
      },
    } as InternalCoreTool['parameters'],
    outputSchema: {
      jsonSchema: {
        type: 'object',
        properties: {
          text: { type: 'string' },
        },
      },
    } as InternalCoreTool['outputSchema'],
    mcp: {
      toolType: 'tool' as MCPToolType,
      _meta: { ui: { resourceUri: 'ui://files/read' } },
    },
    strict: true,
    ...overrides,
  };
}

async function makeSession() {
  const server = new MockMcpServer({
    id: 'filesystem',
    name: 'Filesystem',
    version: '1.2.3',
    description: 'Filesystem tools',
    instructions: 'Use for local files.',
    repository: { url: 'https://example.test/repo', source: 'github' } as any,
    packageCanonical: 'npm',
    packages: [{ registry_name: 'npm', name: '@example/filesystem-mcp', version: '1.2.3' }] as any,
    remotes: [{ transport_type: 'sse', url: 'https://example.test/mcp' }],
    tools: {
      read_file: makeTool(),
    },
  });
  const harness = new Harness({
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
  });
  new Mastra({
    agents: { default: makeAgent() },
    storage: new InMemoryStore(),
    mcpServers: { files: server },
    harness,
  });
  const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
  return { session, server };
}

describe('Session MCP catalog (PF-562)', () => {
  it('lists registered MCP server descriptors by Mastra registration key', async () => {
    const { session } = await makeSession();

    expect(session.mcp.listServers()).toEqual([
      expect.objectContaining({
        key: 'files',
        id: 'filesystem',
        name: 'Filesystem',
        version: '1.2.3',
        description: 'Filesystem tools',
        instructions: 'Use for local files.',
        releaseDate: expect.any(String),
        isLatest: true,
        packageCanonical: 'npm',
        repository: { url: 'https://example.test/repo', source: 'github' },
        packages: [{ registry_name: 'npm', name: '@example/filesystem-mcp', version: '1.2.3' }],
        remotes: [{ transport_type: 'sse', url: 'https://example.test/mcp' }],
      }),
    ]);
    expect(session.mcp.getServer('files')).toMatchObject({ key: 'files', id: 'filesystem' });
    expect(session.mcp.getServer('missing')).toBeUndefined();
  });

  it('lists registered MCP tool descriptors through the server tool-list contract', async () => {
    const { session, server } = await makeSession();

    await expect(session.mcp.listTools('files')).resolves.toEqual([
      {
        serverKey: 'files',
        name: 'read_file',
        description: 'Read files',
        inputSchema: {
          type: 'object',
          properties: { path: { type: 'string' } },
        },
        outputSchema: {
          type: 'object',
          properties: { text: { type: 'string' } },
        },
        toolType: 'tool',
        meta: { ui: { resourceUri: 'ui://files/read' } },
        strict: true,
      },
    ]);
    expect(server.lastToolListRequestContext?.get('harness')).toMatchObject({
      resourceId: 'u1',
      sessionId: session.id,
      modeId: 'default',
    });
    await expect(session.mcp.listTools('missing')).resolves.toBeUndefined();
  });

  it('lists lazy MCP client proxy tools through the server tool-list contract', async () => {
    const server = new LazyMockMcpServer(
      {
        id: 'remote',
        name: 'Remote',
        version: '1.0.0',
        description: 'Remote tools',
      },
      [
        {
          id: 'remote_search',
          name: 'Remote Search',
          description: 'Search remote data',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              result: { type: 'string' },
            },
          },
          toolType: 'tool' as MCPToolType,
          _meta: { ui: { resourceUri: 'ui://remote/search' } },
        },
      ],
      {
        remote_search: makeTool({
          strict: true,
          mcp: {
            toolType: 'tool' as MCPToolType,
            _meta: { ui: { resourceUri: 'ui://remote/search' } },
          },
        }),
      },
    );
    const harness = new Harness({
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });
    new Mastra({
      agents: { default: makeAgent() },
      storage: new InMemoryStore(),
      mcpServers: { remote: server },
      harness,
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.mcp.listTools('remote')).resolves.toEqual([
      {
        serverKey: 'remote',
        name: 'remote_search',
        description: 'Search remote data',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
        },
        outputSchema: {
          type: 'object',
          properties: { result: { type: 'string' } },
        },
        toolType: 'tool',
        meta: { ui: { resourceUri: 'ui://remote/search' } },
        strict: true,
      },
    ]);
    expect(server.lastToolListRequestContext?.get('harness')).toMatchObject({
      resourceId: 'u1',
      sessionId: session.id,
      modeId: 'default',
    });
  });

  it('returns clone-safe MCP server and tool snapshots', async () => {
    const { session, server } = await makeSession();
    const firstServer = session.mcp.getServer('files')!;
    const firstTool = (await session.mcp.listTools('files'))![0]!;

    (firstServer.repository as Record<string, unknown>).url = 'mutated';
    (firstServer.packages![0] as Record<string, unknown>).name = 'mutated';
    ((firstTool.inputSchema as Record<string, any>).properties.path as Record<string, unknown>).type = 'number';
    (firstTool.meta!.ui as Record<string, unknown>).resourceUri = 'mutated';

    expect(session.mcp.getServer('files')!.repository).toEqual({ url: 'https://example.test/repo', source: 'github' });
    expect(session.mcp.getServer('files')!.packages![0]).toMatchObject({ name: '@example/filesystem-mcp' });
    expect(((await session.mcp.listTools('files'))![0]!.inputSchema as Record<string, any>).properties.path.type).toBe(
      'string',
    );
    expect(((await session.mcp.listTools('files'))![0]!.meta!.ui as Record<string, unknown>).resourceUri).toBe(
      'ui://files/read',
    );
    expect(server.repository).toEqual({ url: 'https://example.test/repo', source: 'github' });
  });

  it('validates MCP catalog lookup keys', async () => {
    const { session } = await makeSession();

    expect(() => session.mcp.getServer('')).toThrow(HarnessValidationError);
    expect(() => session.mcp.listTools('')).toThrow(HarnessValidationError);
    expect(() => session.mcp.getServer('__proto__')).toThrow(HarnessValidationError);
    expect(() => session.mcp.listTools('constructor')).toThrow(HarnessValidationError);
    expect(() => session.mcp.getServer('toString')).toThrow(HarnessValidationError);
    expect(() => session.mcp.listTools('hasOwnProperty')).toThrow(HarnessValidationError);
  });
});
