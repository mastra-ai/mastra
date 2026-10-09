import type { McpServerListResponse, McpServerToolListResponse } from '@mastra/client-js';
import type { ReadMcpServerResourceResponse } from '../../use-mcp-app-html';

export const mcpServersResponse: McpServerListResponse = {
  servers: [
    {
      id: 'weather-server',
      name: 'Weather Server',
      version_detail: { version: '1.0.0', release_date: '2026-01-01T00:00:00Z', is_latest: true },
    },
  ],
  total_count: 1,
  next: null,
};

export const weatherToolsResponse: McpServerToolListResponse = {
  tools: [
    { name: 'getForecast', description: 'Get the forecast', inputSchema: '{}' },
    {
      name: 'showMap',
      description: 'Show a map',
      inputSchema: '{}',
      _meta: { ui: { resourceUri: 'ui://weather/map' } },
    },
  ],
};

export const mapAppResourceResponse: ReadMcpServerResourceResponse = {
  contents: [{ uri: 'ui://weather/map', text: '<html><body>Map</body></html>' }],
};
