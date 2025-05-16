// packages/deployer/src/server/handlers/__tests__/mcp.test.ts

import type { Mastra } from '@mastra/core';
// Consolidate imports from @mastra/core/mcp
import type { MCPServerBase as MastraMCPServerImplementation, ServerInfo, ServerDetailInfo } from '@mastra/core/mcp';
import { toReqRes, toFetchResponse } from 'fetch-to-node';
import type { Context } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleError } from '../error';
import { getMcpServerMessageHandler, listMcpRegistryServersHandler, getMcpRegistryServerDetailHandler } from '../mcp';

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
      httpPath: `/api/mcp/${serverId}/mcp`,
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

describe('listMcpRegistryServersHandler', () => {
  let mockMastra: Partial<Mastra>;
  const server1Info: ServerInfo = {
    id: 'server1',
    name: 'Test Server 1',
    version_detail: { version: '1.0', release_date: '2023-01-01T00:00:00Z', is_latest: true },
  };
  const server2Info: ServerInfo = {
    id: 'server2',
    name: 'Test Server 2',
    version_detail: { version: '1.1', release_date: '2023-02-01T00:00:00Z', is_latest: true },
  };

  const mockServer1: Partial<MastraMCPServerImplementation> = {
    id: 'server1',
    getServerInfo: vi.fn(() => server1Info),
  };
  const mockServer2: Partial<MastraMCPServerImplementation> = {
    id: 'server2',
    getServerInfo: vi.fn(() => server2Info),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMastra = {
      getMCPServers: vi.fn(),
    };
  });

  it('should list all servers correctly without pagination', async () => {
    (mockMastra.getMCPServers as ReturnType<typeof vi.fn>).mockReturnValue({
      server1: mockServer1 as MastraMCPServerImplementation,
      server2: mockServer2 as MastraMCPServerImplementation,
    });
    const mockContext = createRegistryMockContext({
      requestUrl: 'http://localhost/api/mcp/v0/servers',
      mastraInstance: mockMastra,
    }) as Context;

    const response = (await listMcpRegistryServersHandler(mockContext)) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockMastra.getMCPServers).toHaveBeenCalledTimes(1);
    expect(body.servers).toEqual([server1Info, server2Info]);
    expect(body.total_count).toBe(2);
    expect(body.next).toBeNull();
  });

  it('should handle pagination correctly (limit and offset)', async () => {
    (mockMastra.getMCPServers as ReturnType<typeof vi.fn>).mockReturnValue({
      server1: mockServer1 as MastraMCPServerImplementation,
      server2: mockServer2 as MastraMCPServerImplementation,
    });
    const mockContext = createRegistryMockContext({
      requestUrl: 'http://localhost/api/mcp/v0/servers?limit=1&offset=0',
      queryParams: { limit: '1', offset: '0' },
      mastraInstance: mockMastra,
    }) as Context;

    const response = (await listMcpRegistryServersHandler(mockContext)) as Response;
    const body = await response.json();

    expect(body.servers).toEqual([server1Info]);
    expect(body.total_count).toBe(2);
    expect(body.next).toBe('http://localhost/api/mcp/v0/servers?limit=1&offset=1');
  });

  it('should return empty list if getMCPServers returns undefined', async () => {
    (mockMastra.getMCPServers as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const mockContext = createRegistryMockContext({
      requestUrl: 'http://localhost/api/mcp/v0/servers',
      mastraInstance: mockMastra,
    }) as Context;

    const response = (await listMcpRegistryServersHandler(mockContext)) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.servers).toEqual([]);
    expect(body.total_count).toBe(0);
    expect(body.next).toBeNull();
  });

  it('should return 500 if Mastra instance or getMCPServers is not available', async () => {
    const mockContext = createRegistryMockContext({
      requestUrl: 'http://localhost/api/mcp/v0/servers',
      mastraInstance: {} as Partial<Mastra>, // Simulate missing getMCPServers
    }) as Context;

    const response = (await listMcpRegistryServersHandler(mockContext)) as Response;
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain('Mastra instance or getMCPServers method not available');
  });
});

describe('getMcpRegistryServerDetailHandler', () => {
  let mockMastra: Partial<Mastra>;
  const serverId = 'server1';
  const serverDetail: ServerDetailInfo = {
    id: serverId,
    name: 'Test Server 1',
    description: 'Detailed description',
    version_detail: { version: '1.0', release_date: '2023-01-01T00:00:00Z', is_latest: true },
    package_canonical: 'npm',
    packages: [],
    remotes: [],
  };
  const mockServer: Partial<MastraMCPServerImplementation> = {
    id: serverId,
    getServerDetail: vi.fn(() => serverDetail),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockMastra = {
      getMCPServer: vi.fn(),
    };
  });

  it('should return server details if server is found', async () => {
    (mockMastra.getMCPServer as ReturnType<typeof vi.fn>).mockReturnValue(mockServer as MastraMCPServerImplementation);
    const mockContext = createRegistryMockContext({
      serverId,
      requestUrl: `http://localhost/api/mcp/v0/servers/${serverId}`,
      mastraInstance: mockMastra,
    }) as Context;

    const response = (await getMcpRegistryServerDetailHandler(mockContext)) as Response;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockMastra.getMCPServer).toHaveBeenCalledWith(serverId);
    expect(mockServer.getServerDetail).toHaveBeenCalledTimes(1);
    expect(body).toEqual(serverDetail);
  });

  it('should return 404 if server is not found', async () => {
    (mockMastra.getMCPServer as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    const mockContext = createRegistryMockContext({
      serverId,
      requestUrl: `http://localhost/api/mcp/v0/servers/${serverId}`,
      mastraInstance: mockMastra,
    }) as Context;

    const response = (await getMcpRegistryServerDetailHandler(mockContext)) as Response;
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe(`MCP server with ID '${serverId}' not found`);
  });

  it('should return 500 if Mastra instance or getMCPServer is not available', async () => {
    const mockContext = createRegistryMockContext({
      serverId,
      requestUrl: `http://localhost/api/mcp/v0/servers/${serverId}`,
      mastraInstance: {} as Partial<Mastra>, // Simulate missing getMCPServer
    }) as Context;

    const response = (await getMcpRegistryServerDetailHandler(mockContext)) as Response;
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toContain('Mastra instance or getMCPServer method not available');
  });
});
