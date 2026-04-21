/**
 * @license Mastra Enterprise License - see ee/LICENSE
 */
import { createTool } from '@mastra/core/tools';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { z } from 'zod/v3';

import { MCPServer } from '../server';

/**
 * Tests for FGA authorization in MCP server tool execution.
 *
 * The MCP server checks FGA authorization before executing tools when:
 * 1. An FGA provider is configured on the mastra instance
 * 2. A user can be identified from the request context
 *
 * When no FGA provider is configured or no user context is available,
 * tool execution proceeds normally (backward compatible).
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

  it('should have mastra property accessible for FGA provider', () => {
    mcpServer = new MCPServer({
      name: 'test-server',
      version: '1.0.0',
      tools: { 'test-tool': testTool },
    });

    // mastra is undefined until registered
    expect(mcpServer.mastra).toBeUndefined();

    // After registration, mastra should be available
    const mockMastra = createMockMastra({ check: vi.fn() });
    mcpServer.__registerMastra(mockMastra as any);
    expect(mcpServer.mastra).toBe(mockMastra);
  });

  it('should have access to FGA provider through mastra.getServer().fga', () => {
    mcpServer = new MCPServer({
      name: 'test-server',
      version: '1.0.0',
      tools: { 'test-tool': testTool },
    });

    const mockFGAProvider = {
      check: vi.fn().mockResolvedValue(true),
      require: vi.fn().mockResolvedValue(undefined),
      filterAccessible: vi.fn().mockImplementation((_u: any, resources: any[]) => Promise.resolve(resources)),
    };

    const mockMastra = createMockMastra(mockFGAProvider);
    mcpServer.__registerMastra(mockMastra as any);

    const fga = mcpServer.mastra?.getServer?.()?.fga;
    expect(fga).toBe(mockFGAProvider);
  });

  it('should return undefined fga when no FGA provider configured', () => {
    mcpServer = new MCPServer({
      name: 'test-server',
      version: '1.0.0',
      tools: { 'test-tool': testTool },
    });

    const mockMastra = createMockMastra();
    mcpServer.__registerMastra(mockMastra as any);

    const fga = mcpServer.mastra?.getServer?.()?.fga;
    expect(fga).toBeUndefined();
  });

  it('should return undefined fga when no mastra instance', () => {
    mcpServer = new MCPServer({
      name: 'test-server',
      version: '1.0.0',
      tools: { 'test-tool': testTool },
    });

    const fga = mcpServer.mastra?.getServer?.()?.fga;
    expect(fga).toBeUndefined();
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
      require: vi.fn().mockRejectedValue(Object.assign(new Error('denied'), { name: 'FGADeniedError', status: 403 })),
      filterAccessible: vi.fn(),
    };

    const mockMastra = createMockMastra(mockFGAProvider);
    mcpServer.__registerMastra(mockMastra as any);

    const requestContext = createRequestContext({ id: 'user-1' });

    await expect(mcpServer.executeTool('test-tool', { input: 'hello' }, { requestContext })).rejects.toThrow('denied');
    expect(execute).not.toHaveBeenCalled();
    expect(mockFGAProvider.require).toHaveBeenCalledWith(
      { id: 'user-1' },
      { resource: { type: 'tool', id: 'test-tool' }, permission: 'tools:execute' },
    );
  });

  it('should skip FGA in executeTool when no user is present', async () => {
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
    ).resolves.toEqual({ output: 'success' });
    expect(mockFGAProvider.require).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalled();
  });
});
