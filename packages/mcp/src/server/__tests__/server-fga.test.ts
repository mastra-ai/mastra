/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
import { FGADeniedError, MastraFGAPermissions } from '@mastra/core/auth/ee';
import { createTool } from '@mastra/core/tools';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { z } from 'zod/v3';

import { MCPServer } from '../server';

/**
 * Tests for FGA authorization in MCP server tool execution.
 *
 * The MCP server checks FGA authorization before executing tools when an FGA
 * provider is configured on the mastra instance.
 *
 * When no FGA provider is configured, tool execution proceeds normally
 * (backward compatible). When an FGA provider is configured and no user context
 * is available, authorization fails closed.
 */

function createMockMastra(fga?: any) {
  return {
    getServer: () => (fga ? { fga } : {}),
    getLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    addTool: vi.fn(),
    addAgent: vi.fn(),
    addWorkflow: vi.fn(),
  };
}

describe('MCP Server FGA checks', () => {
  let mcpServer: MCPServer;

  const createRequestContext = (user?: { id: string }) => {
    const values = new Map<string, unknown>();
    if (user) {
      values.set('user', user);
    }

    return {
      get: (key: string) => values.get(key),
      set: (key: string, value: unknown) => {
        values.set(key, value);
      },
    };
  };

  const testTool = createTool({
    id: 'test-tool',
    description: 'A test tool',
    inputSchema: z.object({ input: z.string() }),
    outputSchema: z.object({ output: z.string() }),
    execute: async () => {
      return { output: 'success' };
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should enforce FGA in executeTool when requestContext has a user', async () => {
    const execute = vi.fn().mockResolvedValue({ output: 'success' });
    mcpServer = new MCPServer({
      name: 'test-server',
      version: '1.0.0',
      tools: {
        'test-tool': createTool({
          id: 'test-tool',
          description: 'A test tool',
          inputSchema: z.object({ input: z.string() }),
          execute,
        }),
      },
    });

    const mockFGAProvider = {
      check: vi.fn().mockResolvedValue(false),
      require: vi
        .fn()
        .mockRejectedValue(
          new FGADeniedError(
            { id: 'user-1' },
            { type: 'tool', id: JSON.stringify([mcpServer.getServerInfo().id, 'test-tool']) },
            MastraFGAPermissions.TOOLS_EXECUTE,
          ),
        ),
      filterAccessible: vi.fn(),
    };

    const mockMastra = createMockMastra(mockFGAProvider);
    mcpServer.__registerMastra(mockMastra as any);

    const requestContext = createRequestContext({ id: 'user-1' });

    await expect(mcpServer.executeTool('test-tool', { input: 'hello' }, { requestContext })).rejects.toMatchObject({
      cause: { name: 'FGADeniedError', status: 403 },
    });
    expect(execute).not.toHaveBeenCalled();
    expect(mockFGAProvider.require).toHaveBeenCalledWith(
      { id: 'user-1' },
      {
        resource: { type: 'tool', id: JSON.stringify([mcpServer.getServerInfo().id, 'test-tool']) },
        permission: MastraFGAPermissions.TOOLS_EXECUTE,
      },
    );
  });

  it('should fail closed in executeTool when FGA is configured and no user is present', async () => {
    const execute = vi.fn().mockResolvedValue({ output: 'success' });
    mcpServer = new MCPServer({
      name: 'test-server',
      version: '1.0.0',
      tools: {
        'test-tool': createTool({
          id: 'test-tool',
          description: 'A test tool',
          inputSchema: z.object({ input: z.string() }),
          execute,
        }),
      },
    });

    const mockFGAProvider = {
      check: vi.fn(),
      require: vi.fn(),
      filterAccessible: vi.fn(),
    };

    const mockMastra = createMockMastra(mockFGAProvider);
    mcpServer.__registerMastra(mockMastra as any);

    await expect(
      mcpServer.executeTool('test-tool', { input: 'hello' }, { requestContext: createRequestContext() as any }),
    ).rejects.toMatchObject({ cause: { name: 'FGADeniedError', status: 403 } });
    expect(mockFGAProvider.require).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it('should filter getToolListInfo by FGA access', async () => {
    mcpServer = new MCPServer({
      name: 'test-server',
      version: '1.0.0',
      tools: {
        allowed: createTool({
          id: 'allowed',
          description: 'Allowed tool',
          inputSchema: z.object({}),
          execute: vi.fn(),
        }),
        denied: createTool({
          id: 'denied',
          description: 'Denied tool',
          inputSchema: z.object({}),
          execute: vi.fn(),
        }),
      },
    });
    const mockFGAProvider = {
      check: vi.fn(),
      require: vi.fn(async (_user: unknown, params: { resource: { id: string } }) => {
        if (params.resource.id === JSON.stringify([mcpServer.getServerInfo().id, 'denied'])) {
          throw new FGADeniedError(
            { id: 'user-1' },
            { type: 'tool', id: JSON.stringify([mcpServer.getServerInfo().id, 'denied']) },
            MastraFGAPermissions.TOOLS_EXECUTE,
          );
        }
      }),
      filterAccessible: vi.fn(),
    };
    mcpServer.__registerMastra(createMockMastra(mockFGAProvider) as any);

    const result = await mcpServer.getToolListInfo(createRequestContext({ id: 'user-1' }) as any);

    expect(result.tools.map(tool => tool.name)).toEqual(['allowed']);
    expect(mockFGAProvider.require).toHaveBeenCalledTimes(2);
  });

  it('should expose outputSchema separately from inputSchema after FGA filtering', async () => {
    mcpServer = new MCPServer({
      name: 'test-server',
      version: '1.0.0',
      tools: { 'test-tool': testTool },
    });
    const mockFGAProvider = {
      check: vi.fn(),
      require: vi.fn(),
      filterAccessible: vi.fn(),
    };
    mcpServer.__registerMastra(createMockMastra(mockFGAProvider) as any);

    const result = await mcpServer.getToolListInfo(createRequestContext({ id: 'user-1' }) as any);

    expect(result.tools[0]?.inputSchema).toMatchObject({
      properties: { input: expect.any(Object) },
    });
    expect(result.tools[0]?.outputSchema).toMatchObject({
      properties: { output: expect.any(Object) },
    });
  });

  it('should return no tools when FGA is configured and list context has no user', async () => {
    mcpServer = new MCPServer({
      name: 'test-server',
      version: '1.0.0',
      tools: {
        'test-tool': createTool({
          id: 'test-tool',
          description: 'A test tool',
          inputSchema: z.object({}),
          execute: vi.fn(),
        }),
      },
    });
    const mockFGAProvider = {
      check: vi.fn(),
      require: vi.fn(),
      filterAccessible: vi.fn(),
    };
    mcpServer.__registerMastra(createMockMastra(mockFGAProvider) as any);

    const result = await mcpServer.getToolListInfo(createRequestContext() as any);

    expect(result.tools).toEqual([]);
    expect(mockFGAProvider.require).not.toHaveBeenCalled();
  });
});
