import type { McpServerListResponse, McpServerToolListResponse, MastraClient } from '@mastra/client-js';
import { TEST_BASE_URL } from '../../../test/render';

type ReadMcpServerResourceResponse = Awaited<ReturnType<MastraClient['readMcpServerResource']>>;

export const MCP_SERVERS_URL = `${TEST_BASE_URL}/api/mcp/v0/servers`;
export const WEATHER_TOOLS_URL = `${TEST_BASE_URL}/api/mcp/weather-server/tools`;
export const WEATHER_RESOURCE_URL = `${TEST_BASE_URL}/api/mcp/weather-server/resources/read`;

/** The name an agent sees the map tool under when it gets it through `MCPClient.listTools()`. */
export const MAP_TOOL = 'weather-server_showMap';

export const mcpServers: McpServerListResponse = {
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

export const weatherTools: McpServerToolListResponse = {
  tools: [
    {
      name: 'showMap',
      description: 'Show a weather map',
      inputSchema: '{}',
      _meta: { ui: { resourceUri: 'ui://weather/map' } },
    },
    { name: 'getForecast', description: 'Get the forecast', inputSchema: '{}' },
    {
      name: 'zoomMap',
      description: 'Zoom the map, for the app only',
      inputSchema: '{}',
      _meta: { ui: { visibility: ['app'] } },
    },
    {
      name: 'deleteStation',
      description: 'Delete a station, for the model only',
      inputSchema: '{}',
      _meta: { ui: { visibility: ['model'] } },
    },
  ],
};

export const mapAppResource: ReadMcpServerResourceResponse = {
  contents: [{ uri: 'ui://weather/map', mimeType: 'text/html;profile=mcp-app', text: '<html><body>Map</body></html>' }],
};
