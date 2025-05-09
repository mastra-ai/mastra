// packages/deployer/src/server/handlers/__tests__/mcp.test.ts

import type { Mastra } from '@mastra/core';
import type { MCPServerBase as MastraMCPServerImplementation } from '@mastra/core/mcp';
import { toReqRes, toFetchResponse } from 'fetch-to-node';
import type { Context } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleError } from '../error';
import { getMcpServerMessageHandler } from '../mcp';

// Mock dependencies
vi.mock('fetch-to-node', () => ({
  toReqRes: vi.fn(),
  toFetchResponse: vi.fn(),
}));

// It's often simpler to mock specific functions from a module if that's all you need.
// If '../error' only exports handleError or you only care about that one:
vi.mock('../error', () => ({
  handleError: vi.fn(),
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
  const requestUrl = `http://localhost/api/servers/${serverId}/mcp`;
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
      getMCPServer: vi.fn().mockReturnValue(mockMCPServer as MastraMCPServerImplementation),
    };
  });

  it('should successfully handle an MCP message and call server.startHTTP', async () => {
    const mockContext = createMockContext(serverId, requestUrl) as Context;
    const result = await getMcpServerMessageHandler(mockContext);
    expect(mockContext.get).toHaveBeenCalledWith('mastra');
    expect(mockMastraInstance.getMCPServer).toHaveBeenCalledWith(serverId);
    expect(toReqRes).toHaveBeenCalledWith(mockContext.req.raw);
    expect(mockMCPServer.startHTTP).toHaveBeenCalledWith({
      url: new URL(requestUrl),
      httpPath: `/api/servers/${serverId}/mcp`,
      req: mockNodeReq,
      res: mockNodeRes,
      options: {
        sessionIdGenerator: undefined,
      },
    });
    expect(toFetchResponse).toHaveBeenCalledWith(mockNodeRes);
    expect(result).toBe(mockFetchRes);
    expect(mockContext.json).not.toHaveBeenCalled();
  });

  it('should return 404 if MCP server is not found', async () => {
    (mockMastraInstance.getMCPServer as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const mockContext = createMockContext(serverId, requestUrl) as Context;
    const result = (await getMcpServerMessageHandler(mockContext)) as Response;
    expect(mockMastraInstance.getMCPServer).toHaveBeenCalledWith(serverId);
    expect(mockContext.json).toHaveBeenCalledWith({ error: `MCP server '${serverId}' not found` }, 404);
    expect(mockMCPServer.startHTTP).not.toHaveBeenCalled();
    expect(result.status).toBe(404);
    const jsonBody = await result.json();
    expect(jsonBody).toEqual({ error: `MCP server '${serverId}' not found` });
  });

  it('should call handleError if server.startHTTP throws an error', async () => {
    const errorMessage = 'Failed to start HTTP';
    const thrownError = new Error(errorMessage);
    (mockMCPServer.startHTTP as ReturnType<typeof vi.fn>).mockRejectedValue(thrownError);

    const mockHttpExceptionMessage = 'Error from handleError';
    const mockHttpExceptionStatus = 500;
    (handleError as ReturnType<typeof vi.fn>).mockImplementation(() => {
      const mockResponse = new Response(JSON.stringify({ error: mockHttpExceptionMessage }), {
        status: mockHttpExceptionStatus,
        headers: { 'Content-Type': 'application/json' },
      });
      return Promise.resolve(mockResponse);
    });

    const mockContext = createMockContext(serverId, requestUrl) as Context;
    const result = await getMcpServerMessageHandler(mockContext);

    expect(mockMCPServer.startHTTP).toHaveBeenCalled();
    expect(handleError).toHaveBeenCalledWith(thrownError, 'Error sending MCP message');

    expect(result.status).toBe(mockHttpExceptionStatus);
    const jsonBody = await result.json();
    expect(jsonBody).toEqual({ error: mockHttpExceptionMessage });

    expect(mockContext.json).not.toHaveBeenCalled();
  });

  it('should pass the correct URL and httpPath to startHTTP', async () => {
    const actualRequestUrl = `http://localhost/api/servers/${serverId}/mcp`;
    const mockContext = createMockContext(serverId, actualRequestUrl) as Context;
    await getMcpServerMessageHandler(mockContext);
    expect(mockMCPServer.startHTTP).toHaveBeenCalledWith(
      expect.objectContaining({
        url: new URL(actualRequestUrl),
        httpPath: `/api/servers/${serverId}/mcp`,
      }),
    );
  });
});
