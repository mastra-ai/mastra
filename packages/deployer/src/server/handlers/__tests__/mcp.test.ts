// packages/deployer/src/server/handlers/__tests__/mcp.test.ts

import type { Mastra } from '@mastra/core/mastra';
// Consolidate imports from @mastra/core/mcp
import type { MCPServerBase as MastraMCPServerImplementation } from '@mastra/core/mcp';
import { toReqRes, toFetchResponse } from 'fetch-to-node';
import type { Context } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMcpServerMessageHandler } from '../mcp';

// Mock dependencies
vi.mock('fetch-to-node', () => ({
  toReqRes: vi.fn(),
  toFetchResponse: vi.fn(),
}));

// Helper to create a mock Hono context
const createMockContext = (serverId: string, requestUrl: string): Partial<Context> => ({
  req: {
    param: vi.fn((key: string) => (key === 'serverId' ? serverId : undefined)),
    url: requestUrl,
    raw: {} as any, // Mock raw request
  } as any,
  get: vi.fn((key: string) => {
    if (key === 'mastra') {
      return mockMastraInstance;
    }
    return undefined;
  }),
  json: vi.fn(
    (data, status) =>
      new Response(JSON.stringify(data), {
        status: status || 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  ) as any,
});

let mockMastraInstance: Partial<Mastra>;
let mockMCPServer: Partial<MastraMCPServerImplementation>;

describe('getMcpServerMessageHandler', () => {
  const serverId = 'test-mcp-server';
  const requestUrl = `http://localhost/api/mcp/${serverId}/mcp`;
  let mockNodeReq: any;
  let mockNodeRes: any;
  let mockFetchRes: Response;

  beforeEach(() => {
    vi.clearAllMocks();

    mockNodeReq = { body: 'test-request-body' };
    mockNodeRes = {
      headersSent: false,
      writeHead: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
    };
    mockFetchRes = new Response('test-response', { status: 200 });

    (toReqRes as ReturnType<typeof vi.fn>).mockReturnValue({ req: mockNodeReq, res: mockNodeRes });
    (toFetchResponse as ReturnType<typeof vi.fn>).mockResolvedValue(mockFetchRes);

    mockMCPServer = {
      name: serverId,
      startHTTP: vi.fn().mockResolvedValue(undefined),
    };

    mockMastraInstance = {
      getMCPServerById: vi.fn().mockReturnValue(mockMCPServer as MastraMCPServerImplementation),
    };
  });

  it('should successfully handle an MCP message and call server.startHTTP', async () => {
    const mockContext = createMockContext(serverId, requestUrl) as Context;
    const result = await getMcpServerMessageHandler(mockContext);
    expect(mockContext.get).toHaveBeenCalledWith('mastra');
    expect(mockMastraInstance.getMCPServerById).toHaveBeenCalledWith(serverId);
    expect(toReqRes).toHaveBeenCalledWith(mockContext.req.raw);
    expect(mockMCPServer.startHTTP).toHaveBeenCalledWith({
      url: new URL(requestUrl),
      httpPath: `/api/mcp/${serverId}/mcp`,
      req: mockNodeReq,
      res: mockNodeRes,
    });
    expect(toFetchResponse).toHaveBeenCalledWith(mockNodeRes);
    expect(result).toBe(mockFetchRes);
    expect(mockContext.json).not.toHaveBeenCalled();
  });

  it('should return 404 if MCP server is not found', async () => {
    (mockMastraInstance.getMCPServerById as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const mockContext = createMockContext(serverId, requestUrl) as Context;
    await getMcpServerMessageHandler(mockContext);
    expect(mockMastraInstance.getMCPServerById).toHaveBeenCalledWith(serverId);
    expect(mockNodeRes.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
    expect(mockNodeRes.end).toHaveBeenCalledWith(JSON.stringify({ error: `MCP server '${serverId}' not found` }));
    expect(mockMCPServer.startHTTP).not.toHaveBeenCalled();
  });

  it('should handle errors from server.startHTTP and return JSON-RPC error response', async () => {
    const errorMessage = 'Failed to start HTTP';
    const thrownError = new Error(errorMessage);
    (mockMCPServer.startHTTP as ReturnType<typeof vi.fn>).mockRejectedValue(thrownError);

    const mockContext = createMockContext(serverId, requestUrl) as Context;
    await getMcpServerMessageHandler(mockContext);

    // Check that we handle the error using Node.js response methods
    expect(mockNodeRes.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
    expect(mockNodeRes.end).toHaveBeenCalledWith(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      }),
    );

    // Make sure we don't use Hono's json method
    expect(mockContext.json).not.toHaveBeenCalled();
  });

  it('should pass the correct URL and httpPath to startHTTP', async () => {
    const actualRequestUrl = `http://localhost/api/mcp/${serverId}/mcp`;
    const mockContext = createMockContext(serverId, actualRequestUrl) as Context;
    await getMcpServerMessageHandler(mockContext);
    expect(mockMCPServer.startHTTP).toHaveBeenCalledWith(
      expect.objectContaining({
        url: new URL(actualRequestUrl),
        httpPath: `/api/mcp/${serverId}/mcp`,
      }),
    );
  });
});

// Updated createMockContext to be more flexible for different handlers
const createRegistryMockContext = ({
  serverId,
  requestUrl,
  queryParams = {},
  mastraInstance,
}: {
  serverId?: string;
  requestUrl: string;
  queryParams?: Record<string, string>;
  mastraInstance: Partial<Mastra>;
}): Partial<Context> => ({
  req: {
    param: vi.fn((key: string) => (key === 'id' ? serverId : undefined)),
    url: requestUrl,
    query: vi.fn((key: string) => queryParams[key]),
    raw: {} as any,
  } as any,
  get: vi.fn((key: string) => {
    if (key === 'mastra') {
      return mastraInstance;
    }
    if (key === 'logger') {
      // Mock logger to prevent errors if called
      return {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
      };
    }
    return undefined;
  }),
  json: vi.fn(
    (data, status) =>
      new Response(JSON.stringify(data), {
        status: status || 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  ) as any,
});
