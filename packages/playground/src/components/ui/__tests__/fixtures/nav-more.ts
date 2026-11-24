import type { ListWorkspacesResponse, McpServerListResponse } from '@mastra/client-js';

export const noMcpServers: McpServerListResponse = {
  servers: [],
  next: null,
  total_count: 0,
};

export const oneMcpServer: McpServerListResponse = {
  servers: [
    {
      id: 'weather-mcp',
      name: 'Weather MCP',
      version_detail: { version: '1.0.0', release_date: '2026-01-01', is_latest: true },
    },
  ],
  next: null,
  total_count: 1,
};

export const noWorkspaces: ListWorkspacesResponse = {
  workspaces: [],
};

export const oneWorkspace: ListWorkspacesResponse = {
  workspaces: [
    {
      id: 'ws-1',
      name: 'Default workspace',
      status: 'ready',
      source: 'mastra',
      capabilities: {
        hasFilesystem: true,
        hasSandbox: false,
        canBM25: false,
        canVector: false,
        canHybrid: false,
        hasSkills: false,
      },
      safety: { readOnly: false },
    },
  ],
};
