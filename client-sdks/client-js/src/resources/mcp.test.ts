import type { ServerDetailInfo } from '@mastra/core/mcp';
import { describe, expect, beforeEach, it, vi } from 'vitest';
import { MastraClient } from '../client';
import type { McpServerListResponse } from '../types';

// Mock fetch globally
global.fetch = vi.fn();

describe('MCP Server Registry Client Methods', () => {
  let client: MastraClient;
  const clientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  // Helper to mock successful API responses
  const mockFetchResponse = (data: any, options: { isStream?: boolean } = {}) => {
    if (options.isStream) {
      let contentType = 'text/event-stream';
      let responseBody: ReadableStream;

      if (data instanceof ReadableStream) {
        responseBody = data;
        contentType = 'audio/mp3';
      } else {
        responseBody = new ReadableStream({
          start(controller) {
            if (typeof data === 'string') {
              controller.enqueue(new TextEncoder().encode(data));
            } else if (typeof data === 'object' && data !== null) {
              controller.enqueue(new TextEncoder().encode(JSON.stringify(data)));
            } else {
              controller.enqueue(new TextEncoder().encode(String(data)));
            }
            controller.close();
          },
        });
      }

      const headers = new Headers();
      if (contentType === 'audio/mp3') {
        headers.set('Transfer-Encoding', 'chunked');
      }
      headers.set('Content-Type', contentType);

      (global.fetch as any).mockResolvedValueOnce(
        new Response(responseBody, {
          status: 200,
          statusText: 'OK',
          headers,
        }),
      );
    } else {
      const response = new Response(undefined, {
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
      });
      response.json = () => Promise.resolve(data);
      (global.fetch as any).mockResolvedValueOnce(response);
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
  });

  const mockServerInfo1 = {
    id: 'mcp-server-1',
    name: 'Test MCP Server 1',
    version_detail: { version: '1.0.0', release_date: '2023-01-01T00:00:00Z', is_latest: true },
  };
  const mockServerInfo2 = {
    id: 'mcp-server-2',
    name: 'Test MCP Server 2',
    version_detail: { version: '1.1.0', release_date: '2023-02-01T00:00:00Z', is_latest: true },
  };

  const mockServerDetail1: ServerDetailInfo = {
    ...mockServerInfo1,
    description: 'Detailed description for server 1',
    package_canonical: 'npm',
    packages: [{ registry_name: 'npm', name: '@example/server1', version: '1.0.0' }],
    remotes: [{ transport_type: 'sse', url: 'http://localhost/sse1' }],
  };

  describe('getMcpServers()', () => {
    it('should fetch a list of MCP servers', async () => {
      const mockResponse: McpServerListResponse = {
        servers: [mockServerInfo1, mockServerInfo2],
        total_count: 2,
        next: null,
      };
      mockFetchResponse(mockResponse);

      const result = await client.getMcpServers();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/mcp/v0/servers`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should fetch MCP servers with perPage and page parameters', async () => {
      const mockResponse: McpServerListResponse = {
        servers: [mockServerInfo1],
        total_count: 2,
        next: '/api/mcp/v0/servers?perPage=1&page=1',
      };
      mockFetchResponse(mockResponse);

      const result = await client.getMcpServers({ perPage: 1, page: 0 });
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/mcp/v0/servers?perPage=1&page=0`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });
  });

  describe('getMcpServerDetails()', () => {
    const serverId = 'mcp-server-1';

    it('should fetch details for a specific MCP server', async () => {
      mockFetchResponse(mockServerDetail1);

      const result = await client.getMcpServerDetails(serverId);
      expect(result).toEqual(mockServerDetail1);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/mcp/v0/servers/${serverId}`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });

    it('should fetch MCP server details with a version parameter', async () => {
      mockFetchResponse(mockServerDetail1);
      const version = '1.0.0';

      const result = await client.getMcpServerDetails(serverId, { version });
      expect(result).toEqual(mockServerDetail1);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/mcp/v0/servers/${serverId}?version=${version}`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });
  });

  describe('getMcpServerTools()', () => {
    it('should fetch tools for a specific MCP server', async () => {
      const serverId = 'mcp-server-1';
      const mockResponse = {
        tools: [
          { name: 'tool1', description: 'First tool' },
          { name: 'tool2', description: 'Second tool' },
        ],
      };
      mockFetchResponse(mockResponse);

      const result = await client.getMcpServerTools(serverId);
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/mcp/${serverId}/tools`,
        expect.objectContaining({
          headers: expect.objectContaining(clientOptions.headers),
        }),
      );
    });
  });

  describe('getMcpServerTool()', () => {
    it('should return MCPTool instance', () => {
      const serverId = 'mcp-server-1';
      const toolId = 'tool-1';

      const mcpTool = client.getMcpServerTool(serverId, toolId);

      expect(mcpTool).toBeDefined();
      expect(mcpTool.constructor.name).toBe('MCPTool');
    });
  });
});
