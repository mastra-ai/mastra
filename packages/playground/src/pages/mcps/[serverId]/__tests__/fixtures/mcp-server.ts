import type { McpServerInfo, McpServerListResponse, McpServerToolListResponse } from '@mastra/client-js';

const versionDetail = {
  version: '1.0.0',
  release_date: '2026-09-03T00:00:00.000Z',
  is_latest: true,
};

export const modernMcpServer = {
  id: 'modern-server',
  name: 'Modern MCP Server',
  version_detail: versionDetail,
  protocol_version: '2026-07-28',
} satisfies McpServerInfo;

export const legacyMcpServer = {
  id: 'legacy-server',
  name: 'Legacy MCP Server',
  version_detail: versionDetail,
  protocol_version: '2025-11-25',
} satisfies McpServerInfo;

export const unknownEraMcpServer = {
  id: 'unknown-server',
  name: 'Older MCP Server',
  version_detail: versionDetail,
} satisfies McpServerInfo;

export const mcpServerList = (server: McpServerInfo): McpServerListResponse => ({
  servers: [server],
  total_count: 1,
  next: null,
});

export const emptyMcpTools: McpServerToolListResponse = { tools: [] };
