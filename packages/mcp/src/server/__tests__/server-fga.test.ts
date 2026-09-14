/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
import { FGADeniedError, MastraFGAPermissions } from '@mastra/core/auth/ee';
import { createMCPTool } from '@mastra/core/mcp';
import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MCPServer } from '../server';
import type { MCPServerConfig } from '../types';
import { connectClient, serveHTTP, textOf } from './harness';

vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

/**
 * FGA authorization on MCP tool listing and execution. With an FGA provider on the
 * Mastra instance every tools/list, tools/call (native and business, on every
 * continuation round) and REST execution is checked; without a user it fails closed.
 */
function mockMastra(fga?: unknown) {
  return {
    getServer: () => (fga ? { fga } : {}),
    getLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    addTool: vi.fn(),
    removeTool: vi.fn(),
  };
}

const provider = (denyIds: string[] = []) => ({
  check: vi.fn(),
  require: vi.fn(async (user: { id: string }, params: { resource: { type: string; id: string } }) => {
    if (denyIds.includes(params.resource.id)) {
      throw new FGADeniedError(user, params.resource, MastraFGAPermissions.TOOLS_EXECUTE);
    }
  }),
  filterAccessible: vi.fn(),
});

const userContext = (id?: string) => {
  const requestContext = new RequestContext();
  if (id) requestContext.set('user', { id });
  return requestContext;
};

const authInfo: AuthInfo = { token: 't', clientId: 'client-1', scopes: [], extra: { subject: 'user-1' } };
const mapAuthInfoToUser: MCPServerConfig['mapAuthInfoToUser'] = ({ authInfo }) => ({
  id: String(authInfo.extra?.subject),
});

function makeServer(config: Partial<MCPServerConfig> = {}) {
  const execute = vi.fn(async (_input: { input: string }, context: { requestContext?: RequestContext }) => ({
    output: (context.requestContext?.get('user') as { id: string } | undefined)?.id ?? 'nobody',
  }));
  const server = new MCPServer({
    name: 'test-server',
    version: '1.0.0',
    tools: {
      'test-tool': createTool({
        id: 'test-tool',
        description: 'A test tool',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute,
      }),
      native: createMCPTool({
        id: 'native',
        description: 'A native tool',
        inputSchema: z.object({}),
        outputSchema: z.string(),
        execute: async () => ({ kind: 'completed', value: 'native ran' }),
      }),
    },
    ...config,
  });
  const resourceId = (toolId: string) => JSON.stringify([server.getServerInfo().id, toolId]);
  return { server, execute, resourceId };
}

describe('MCP Server FGA checks', () => {
  it('enforces FGA in executeTool and fails closed without a user', async () => {
    const { server, execute, resourceId } = makeServer();
    const fga = provider([resourceId('test-tool')]);
    server.__registerMastra(mockMastra(fga) as any);

    const requestContext = userContext('user-1');
    await expect(server.executeTool('test-tool', { input: 'hello' }, { requestContext })).rejects.toMatchObject({
      name: 'FGADeniedError',
      status: 403,
    });
    expect(execute).not.toHaveBeenCalled();
    expect(fga.require).toHaveBeenCalledWith(
      { id: 'user-1' },
      expect.objectContaining({
        resource: { type: 'tool', id: resourceId('test-tool') },
        permission: MastraFGAPermissions.TOOLS_EXECUTE,
        context: expect.objectContaining({
          resourceId: resourceId('test-tool'),
          requestContext,
          metadata: expect.objectContaining({ mcpServerName: 'test-server', toolId: 'test-tool' }),
        }),
      }),
    );

    fga.require.mockClear();
    await expect(
      server.executeTool('test-tool', { input: 'hello' }, { requestContext: userContext() }),
    ).rejects.toMatchObject({ name: 'FGADeniedError', status: 403 });
    await expect(server.executeTool('test-tool', { input: 'hello' })).rejects.toMatchObject({ name: 'FGADeniedError' });
    expect(fga.require).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('filters getToolListInfo by FGA access and returns nothing without a user', async () => {
    const { server, resourceId } = makeServer();
    const fga = provider([resourceId('native')]);
    server.__registerMastra(mockMastra(fga) as any);

    const listed = await server.getToolListInfo(userContext('user-1'));
    expect(listed.tools.map(tool => tool.name)).toEqual(['test-tool']);
    expect(listed.tools[0]?.inputSchema).toMatchObject({ properties: { input: expect.any(Object) } });
    expect(listed.tools[0]?.outputSchema).toMatchObject({ properties: { output: expect.any(Object) } });
    expect(fga.require).toHaveBeenCalledTimes(2);

    expect((await server.getToolListInfo(userContext())).tools).toEqual([]);
    expect((await server.getToolListInfo()).tools).toEqual([]);
    expect(fga.require).toHaveBeenCalledTimes(2);
  });

  it('uses an empty object input schema for schema-less tools', async () => {
    const server = new MCPServer({
      name: 'test-server',
      version: '1.0.0',
      tools: { plain: createTool({ id: 'plain', description: 'Schema-less', execute: async () => 'ok' }) },
    });
    expect((await server.getToolListInfo()).tools[0]?.inputSchema).toEqual({ type: 'object', properties: {} });
    expect(server.getToolInfo('plain')?.inputSchema).toEqual({ type: 'object', properties: {} });
  });

  it('maps transport auth to the user before filtering tools/list and enforcing tools/call', async () => {
    const { server, execute, resourceId } = makeServer({ mapAuthInfoToUser });
    const fga = provider([resourceId('native')]);
    server.__registerMastra(mockMastra(fga) as any);
    const served = await serveHTTP(server, { auth: authInfo });
    try {
      const client = await connectClient(served.url);
      try {
        expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(['test-tool']);
        const result = await client.callTool({ name: 'test-tool', arguments: { input: 'hello' } });
        expect(result.structuredContent).toEqual({ output: 'user-1' });
        expect(execute).toHaveBeenCalledTimes(1);
        const denied = await client.callTool({ name: 'native', arguments: {} });
        expect(denied.isError).toBe(true);
        expect(textOf(denied)).toContain('denied');
        expect(fga.require).toHaveBeenCalledWith(
          { id: 'user-1' },
          expect.objectContaining({ resource: { type: 'tool', id: resourceId('native') } }),
        );
      } finally {
        await client.close();
      }
    } finally {
      await served.close();
    }
  });

  it('fails closed over the wire when no user can be mapped', async () => {
    const { server, execute } = makeServer();
    const fga = provider();
    server.__registerMastra(mockMastra(fga) as any);
    const served = await serveHTTP(server);
    try {
      const client = await connectClient(served.url);
      try {
        expect((await client.listTools()).tools).toEqual([]);
        const result = await client.callTool({ name: 'test-tool', arguments: { input: 'hello' } });
        expect(result.isError).toBe(true);
        expect(execute).not.toHaveBeenCalled();
        expect(fga.require).not.toHaveBeenCalled();
      } finally {
        await client.close();
      }
    } finally {
      await served.close();
    }
  });

  it('applies server FGA mapping overrides to listing and execution', async () => {
    const deriveId = vi.fn(({ user }: { user: { id: string } }) => user.id);
    const { server, execute, resourceId } = makeServer({
      fga: {
        resourceMapping: { tool: { fgaResourceType: 'mcp-user', deriveId } },
        permissionMapping: { [MastraFGAPermissions.TOOLS_EXECUTE]: 'read' },
      },
    });
    const fga = provider();
    server.__registerMastra(mockMastra(fga) as any);
    const requestContext = userContext('user-1');

    expect((await server.getToolListInfo(requestContext)).tools.map(tool => tool.name)).toEqual([
      'test-tool',
      'native',
    ]);
    await server.executeTool('test-tool', { input: 'hello' }, { requestContext });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(deriveId).toHaveBeenCalledWith({
      user: { id: 'user-1' },
      resourceId: resourceId('test-tool'),
      requestContext,
    });
    expect(fga.require).toHaveBeenCalledWith(
      { id: 'user-1' },
      expect.objectContaining({ resource: { type: 'mcp-user', id: 'user-1' }, permission: 'read' }),
    );
  });
});
