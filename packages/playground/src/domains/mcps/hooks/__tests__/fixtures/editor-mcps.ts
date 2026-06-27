import type { McpServerListResponse, McpServerToolListResponse } from '@mastra/client-js';

export const mcpServersResponse: McpServerListResponse = {
  servers: [
    {
      id: 'simple-mcp-server',
      name: 'Simple MCP Server',
      description: 'Runtime-registered MCP server exposed to Studio.',
      repository: {
        url: 'https://example.com/simple-mcp-server',
        source: 'github',
        id: 'simple-mcp-server',
      },
      version_detail: {
        version: '1.0.0',
        release_date: '2026-01-01T00:00:00.000Z',
        is_latest: true,
      },
    },
  ],
  next: null,
  total_count: 1,
};

export const mcpToolsResponse: McpServerToolListResponse = {
  tools: [
    {
      id: 'simple-mcp-server/weather',
      name: 'weather',
      description: 'Fetch weather from the MCP server.',
      inputSchema: JSON.stringify({ type: 'object', properties: { city: { type: 'string' } } }),
    },
  ],
};
