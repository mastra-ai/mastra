import type { Mastra } from '@mastra/core/mastra';
import type { MCPServerBase, ServerInfo, ServerDetailInfo } from '@mastra/core/mcp';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HTTPException } from '../http-exception';
import {
  LIST_MCP_SERVERS_ROUTE,
  GET_MCP_SERVER_DETAIL_ROUTE,
  LIST_MCP_SERVER_TOOLS_ROUTE,
  GET_MCP_SERVER_TOOL_DETAIL_ROUTE,
  EXECUTE_MCP_SERVER_TOOL_ROUTE,
} from './mcp';
import { createTestServerContext } from './test-utils';

/**
 * MCP Registry Handler Tests
 *
 * These tests verify the handler logic for MCP registry routes (non-transport).
 * Transport handlers (HTTP/SSE) are tested separately in adapter-specific files.
 *
 * Note: These tests will fail until the routes are moved from packages/deployer
 * to packages/server as part of the migration strategy.
 */
describe('MCP Registry Handlers', () => {
  let mockMastra: Mastra;
  let mockMCPServer: Partial<MCPServerBase>;

  const server1Info: ServerInfo = {
    id: 'server1',
    name: 'Test Server 1',
    version_detail: {
      version: '1.0.0',
      release_date: '2023-01-01T00:00:00Z',
      is_latest: true,
    },
    source: 'code',
  };

  const server2Info: ServerInfo = {
    id: 'server2',
    name: 'Test Server 2',
    version_detail: {
      version: '1.1.0',
      release_date: '2023-02-01T00:00:00Z',
      is_latest: true,
    },
    source: 'code',
  };

  const serverDetail: ServerDetailInfo = {
    id: 'server1',
    name: 'Test Server 1',
    description: 'Detailed description',
    version_detail: {
      version: '1.0.0',
      release_date: '2023-01-01T00:00:00Z',
      is_latest: true,
    },
    package_canonical: 'npm',
    packages: [],
    remotes: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockMCPServer = {
      id: 'server1',
      name: 'Test Server 1',
      getServerInfo: vi.fn(() => server1Info),
      getServerDetail: vi.fn(() => serverDetail),
      getToolListInfo: vi.fn(() => ({
        tools: [
          { name: 'tool1', description: 'Tool 1' },
          { name: 'tool2', description: 'Tool 2' },
        ],
      })),
      getToolInfo: vi.fn((toolId: string) => {
        if (toolId === 'tool1') {
          return { name: 'tool1', description: 'Tool 1', inputSchema: {} };
        }
        return null;
      }),
      executeTool: vi.fn(async (toolId: string, data: unknown) => {
        return { result: 'success', toolId, data };
      }),
    };

    mockMastra = {
      listMCPServers: vi.fn(() => ({
        server1: mockMCPServer as MCPServerBase,
        server2: { ...mockMCPServer, id: 'server2', getServerInfo: () => server2Info } as MCPServerBase,
      })),
      getMCPServerById: vi.fn((id: string) => {
        if (id === 'server1') return mockMCPServer as MCPServerBase;
        return undefined;
      }),
    } as unknown as Mastra;
  });

  describe('LIST_MCP_SERVERS_ROUTE', () => {
    it('should return empty list when no servers registered', async () => {
      const emptyMastra = {
        listMCPServers: vi.fn(() => ({})),
      } as unknown as Mastra;

      const result = await LIST_MCP_SERVERS_ROUTE.handler({
        ...createTestServerContext({ mastra: emptyMastra }),
      });

      expect(result.servers).toEqual([]);
      expect(result.total_count).toBe(0);
      expect(result.next).toBeNull();
    });

    it('should return all servers when no pagination params provided', async () => {
      const result = await LIST_MCP_SERVERS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
      });

      expect(result.servers).toHaveLength(2);
      expect(result.total_count).toBe(2);
      expect(result.next).toBeNull();
      expect(result.servers[0]).toEqual(server1Info);
      expect(result.servers[1]).toEqual(server2Info);
    });

    it('should paginate servers when perPage is provided', async () => {
      const result = await LIST_MCP_SERVERS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        perPage: 1,
        page: 0,
      });

      expect(result.servers).toHaveLength(1);
      expect(result.total_count).toBe(2);
      expect(result.next).toContain('perPage=1');
      expect(result.next).toContain('page=1');
      expect(result.servers[0]).toEqual(server1Info);
    });

    it('should paginate servers when legacy limit/offset is provided', async () => {
      const result = await LIST_MCP_SERVERS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        limit: 1,
        offset: 0,
      });

      expect(result.servers).toHaveLength(1);
      expect(result.total_count).toBe(2);
      // Next URL mirrors request format (legacy limit/offset)
      expect(result.next).toContain('limit=1');
      expect(result.next).toContain('offset=1');
      expect(result.servers[0]).toEqual(server1Info);
    });

    it('should calculate next URL correctly', async () => {
      const result = await LIST_MCP_SERVERS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        perPage: 1,
        page: 0,
      });

      expect(result.next).toBe('/mcp/v0/servers?perPage=1&page=1');
    });

    it('should return null for next when no more results', async () => {
      const result = await LIST_MCP_SERVERS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        perPage: 10,
        page: 0,
      });

      expect(result.next).toBeNull();
    });

    it('should handle page correctly', async () => {
      const result = await LIST_MCP_SERVERS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        perPage: 1,
        page: 1,
      });

      expect(result.servers).toHaveLength(1);
      expect(result.servers[0]).toEqual(server2Info);
      expect(result.next).toBeNull(); // No more results
    });

    it('should convert legacy offset to page', async () => {
      const result = await LIST_MCP_SERVERS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        limit: 1,
        offset: 1,
      });

      expect(result.servers).toHaveLength(1);
      expect(result.servers[0]).toEqual(server2Info);
      expect(result.next).toBeNull(); // No more results
    });

    it('should throw 500 when listMCPServers is not available', async () => {
      const invalidMastra = {} as Mastra;

      await expect(
        LIST_MCP_SERVERS_ROUTE.handler({
          ...createTestServerContext({ mastra: invalidMastra }),
        }),
      ).rejects.toThrow(HTTPException);
    });
  });

  describe('GET_MCP_SERVER_DETAIL_ROUTE', () => {
    it('should throw 404 when server not found', async () => {
      await expect(
        GET_MCP_SERVER_DETAIL_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          id: 'non-existent',
        }),
      ).rejects.toThrow(HTTPException);

      await expect(
        GET_MCP_SERVER_DETAIL_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          id: 'non-existent',
        }),
      ).rejects.toThrow(/not found/);
    });

    it('should return server details when found', async () => {
      const result = await GET_MCP_SERVER_DETAIL_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        id: 'server1',
      });

      expect(result).toEqual({ ...serverDetail, source: 'code' });
      expect(mockMCPServer.getServerDetail).toHaveBeenCalledTimes(1);
    });

    it('should validate version parameter when provided', async () => {
      const result = await GET_MCP_SERVER_DETAIL_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        id: 'server1',
        version: '1.0.0',
      });

      expect(result).toEqual({ ...serverDetail, source: 'code' });
    });

    it('should throw 404 when version does not match', async () => {
      await expect(
        GET_MCP_SERVER_DETAIL_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          id: 'server1',
          version: '2.0.0',
        }),
      ).rejects.toThrow(HTTPException);

      await expect(
        GET_MCP_SERVER_DETAIL_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          id: 'server1',
          version: '2.0.0',
        }),
      ).rejects.toThrow(/not version/);
    });

    it('should throw 500 when getMCPServerById is not available', async () => {
      const invalidMastra = {} as Mastra;

      await expect(
        GET_MCP_SERVER_DETAIL_ROUTE.handler({
          ...createTestServerContext({ mastra: invalidMastra }),
          id: 'server1',
        }),
      ).rejects.toThrow(HTTPException);
    });
  });

  describe('LIST_MCP_SERVER_TOOLS_ROUTE', () => {
    it('should throw 404 when server not found', async () => {
      await expect(
        LIST_MCP_SERVER_TOOLS_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          serverId: 'non-existent',
        }),
      ).rejects.toThrow(HTTPException);

      await expect(
        LIST_MCP_SERVER_TOOLS_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          serverId: 'non-existent',
        }),
      ).rejects.toThrow(/not found/);
    });

    it('should return tool list for server', async () => {
      const result = await LIST_MCP_SERVER_TOOLS_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        serverId: 'server1',
      });

      expect(result).toEqual({
        tools: [
          { name: 'tool1', description: 'Tool 1' },
          { name: 'tool2', description: 'Tool 2' },
        ],
      });
      expect(mockMCPServer.getToolListInfo).toHaveBeenCalledTimes(1);
    });

    it('should throw 501 when server does not support getToolListInfo', async () => {
      const serverWithoutTools = {
        ...mockMCPServer,
        getToolListInfo: undefined,
      };

      const mastra = {
        getMCPServerById: vi.fn(() => serverWithoutTools as MCPServerBase),
      } as unknown as Mastra;

      await expect(
        LIST_MCP_SERVER_TOOLS_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          serverId: 'server1',
        }),
      ).rejects.toThrow(HTTPException);

      await expect(
        LIST_MCP_SERVER_TOOLS_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          serverId: 'server1',
        }),
      ).rejects.toThrow(/cannot list tools/);
    });
  });

  describe('GET_MCP_SERVER_TOOL_DETAIL_ROUTE', () => {
    it('should throw 404 when server not found', async () => {
      await expect(
        GET_MCP_SERVER_TOOL_DETAIL_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          serverId: 'non-existent',
          toolId: 'tool1',
        }),
      ).rejects.toThrow(HTTPException);

      await expect(
        GET_MCP_SERVER_TOOL_DETAIL_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          serverId: 'non-existent',
          toolId: 'tool1',
        }),
      ).rejects.toThrow(/server.*not found/i);
    });

    it('should throw 404 when tool not found', async () => {
      await expect(
        GET_MCP_SERVER_TOOL_DETAIL_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          serverId: 'server1',
          toolId: 'non-existent',
        }),
      ).rejects.toThrow(HTTPException);

      await expect(
        GET_MCP_SERVER_TOOL_DETAIL_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          serverId: 'server1',
          toolId: 'non-existent',
        }),
      ).rejects.toThrow(/tool.*not found/i);
    });

    it('should return tool details when found', async () => {
      const result = await GET_MCP_SERVER_TOOL_DETAIL_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        serverId: 'server1',
        toolId: 'tool1',
      });

      expect(result).toEqual({
        name: 'tool1',
        description: 'Tool 1',
        inputSchema: {},
      });
      expect(mockMCPServer.getToolInfo).toHaveBeenCalledWith('tool1');
    });

    it('should throw 501 when server does not support getToolInfo', async () => {
      const serverWithoutTools = {
        ...mockMCPServer,
        getToolInfo: undefined,
      };

      const mastra = {
        getMCPServerById: vi.fn(() => serverWithoutTools as MCPServerBase),
      } as unknown as Mastra;

      await expect(
        GET_MCP_SERVER_TOOL_DETAIL_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          serverId: 'server1',
          toolId: 'tool1',
        }),
      ).rejects.toThrow(HTTPException);

      await expect(
        GET_MCP_SERVER_TOOL_DETAIL_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          serverId: 'server1',
          toolId: 'tool1',
        }),
      ).rejects.toThrow(/cannot provide tool details/);
    });
  });

  describe('EXECUTE_MCP_SERVER_TOOL_ROUTE', () => {
    it('should throw 404 when server not found', async () => {
      await expect(
        EXECUTE_MCP_SERVER_TOOL_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          serverId: 'non-existent',
          toolId: 'tool1',
          data: {},
        }),
      ).rejects.toThrow(HTTPException);

      await expect(
        EXECUTE_MCP_SERVER_TOOL_ROUTE.handler({
          ...createTestServerContext({ mastra: mockMastra }),
          serverId: 'non-existent',
          toolId: 'tool1',
          data: {},
        }),
      ).rejects.toThrow(/server.*not found/i);
    });

    it('should execute tool with provided data', async () => {
      const testData = { input: 'test' };

      const result = await EXECUTE_MCP_SERVER_TOOL_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        serverId: 'server1',
        toolId: 'tool1',
        data: testData,
      });

      expect(result).toEqual({
        result: { result: 'success', toolId: 'tool1', data: testData },
      });
      expect(mockMCPServer.executeTool).toHaveBeenCalledWith('tool1', testData);
    });

    it('should execute tool without data', async () => {
      const result = await EXECUTE_MCP_SERVER_TOOL_ROUTE.handler({
        ...createTestServerContext({ mastra: mockMastra }),
        serverId: 'server1',
        toolId: 'tool1',
      });

      expect(result).toEqual({
        result: { result: 'success', toolId: 'tool1', data: undefined },
      });
      expect(mockMCPServer.executeTool).toHaveBeenCalledWith('tool1', undefined);
    });

    it('should handle tool execution errors', async () => {
      const mockError = new Error('Tool execution failed');
      mockMCPServer.executeTool = vi.fn().mockRejectedValue(mockError);

      const mastra = {
        getMCPServerById: vi.fn(() => mockMCPServer as MCPServerBase),
      } as unknown as Mastra;

      await expect(
        EXECUTE_MCP_SERVER_TOOL_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          serverId: 'server1',
          toolId: 'tool1',
          data: {},
        }),
      ).rejects.toThrow('Tool execution failed');
    });

    it('should throw 501 when server does not support executeTool', async () => {
      const serverWithoutExecution = {
        ...mockMCPServer,
        executeTool: undefined,
      };

      const mastra = {
        getMCPServerById: vi.fn(() => serverWithoutExecution as MCPServerBase),
      } as unknown as Mastra;

      await expect(
        EXECUTE_MCP_SERVER_TOOL_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          serverId: 'server1',
          toolId: 'tool1',
          data: {},
        }),
      ).rejects.toThrow(HTTPException);

      await expect(
        EXECUTE_MCP_SERVER_TOOL_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          serverId: 'server1',
          toolId: 'tool1',
          data: {},
        }),
      ).rejects.toThrow(/cannot execute tools/);
    });
  });
});
