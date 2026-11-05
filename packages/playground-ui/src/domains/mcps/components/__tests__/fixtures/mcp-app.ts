import type { McpAppToolInfo, ReadMcpServerResourceResponse } from '@mastra/react/hooks/mcps';

export const dashboardAppInfo: McpAppToolInfo = {
  serverId: 'observability',
  toolId: 'showDashboard',
  toolName: 'showDashboard',
  resourceUri: 'ui://dashboard/app',
};

export const dashboardAppResource: ReadMcpServerResourceResponse = {
  contents: [{ uri: 'ui://dashboard/app', text: '<!DOCTYPE html><html><body>dashboard</body></html>' }],
};
