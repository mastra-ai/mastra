import type { ListWorkspacesResponse, McpServerListResponse } from '@mastra/client-js';

export const noMcpServers: McpServerListResponse = {
  servers: [],
  next: null,
  total_count: 0,
};

export const noWorkspaces: ListWorkspacesResponse = {
  workspaces: [],
};
