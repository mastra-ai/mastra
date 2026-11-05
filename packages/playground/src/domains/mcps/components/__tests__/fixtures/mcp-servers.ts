import type { McpServerInfo, McpServerToolListResponse, McpToolInfo } from '@mastra/client-js';
import type { AuthCapabilities } from '@mastra/react/hooks/auth';
import type { ReadMcpServerResourceResponse } from '@mastra/react/hooks/mcps';

const versionDetail: McpServerInfo['version_detail'] = {
  version: '1.0.0',
  release_date: '2026-07-28T00:00:00Z',
  is_latest: true,
};

/** A published MCP 1.x server: Streamable HTTP plus the legacy SSE endpoint. */
export const legacyServer: McpServerInfo = {
  id: 'legacy',
  name: 'Legacy Server',
  version_detail: versionDetail,
  transports: ['streamable-http', 'sse'],
};

/** An MCP v2 server: Streamable HTTP only. */
export const v2Server: McpServerInfo = {
  id: 'v2',
  name: 'V2 Server',
  version_detail: versionDetail,
  transports: ['streamable-http'],
};

/** A server that predates transport reporting: Studio treats it as 1.x. */
export const legacyServerWithoutTransports: McpServerInfo = {
  id: 'older',
  name: 'Older Server',
  version_detail: versionDetail,
};

export const echoTool: McpToolInfo = {
  id: 'echo',
  name: 'echo',
  description: 'Echoes its input',
  inputSchema: JSON.stringify({ type: 'object', properties: { message: { type: 'string' } } }),
};

/** A tool that ships an MCP App, rendered above its Playground form. */
export const dashboardTool: McpToolInfo = {
  id: 'showDashboard',
  name: 'showDashboard',
  description: 'Shows a dashboard',
  inputSchema: JSON.stringify({ type: 'object', properties: {} }),
  _meta: { ui: { resourceUri: 'ui://dashboard/app' } },
};

export const dashboardAppResource: ReadMcpServerResourceResponse = {
  contents: [{ uri: 'ui://dashboard/app', text: '<!DOCTYPE html><html><body>dashboard</body></html>' }],
};

/** The dashboard app's data relay: callable by the app only. */
export const relayTool: McpToolInfo = {
  id: 'observabilityMetricAggregate',
  name: 'observabilityMetricAggregate',
  description: 'Reads observability data for the app',
  inputSchema: JSON.stringify({ type: 'object', properties: {} }),
  _meta: { ui: { visibility: ['app'] } },
};

/** A tool the server keeps for the model: apps must not call it. */
export const modelOnlyTool: McpToolInfo = {
  id: 'deleteTraces',
  name: 'deleteTraces',
  description: 'Deletes traces',
  inputSchema: JSON.stringify({ type: 'object', properties: {} }),
  _meta: { ui: { visibility: ['model'] } },
};

export const dashboardServerTools: McpServerToolListResponse = { tools: [dashboardTool, relayTool, modelOnlyTool] };

export const emptyToolList: McpServerToolListResponse = { tools: [] };

export const toolList: McpServerToolListResponse = {
  tools: [
    echoTool,
    {
      id: 'weather-dashboard',
      name: 'weather-dashboard',
      description: 'Renders a weather dashboard',
      inputSchema: JSON.stringify({ type: 'object', properties: {} }),
      _meta: { ui: { resourceUri: 'ui://weather/dashboard' } },
    },
    {
      id: 'research-agent',
      name: 'research-agent',
      description: 'Delegates to the research agent',
      inputSchema: JSON.stringify({ type: 'object', properties: {} }),
      toolType: 'agent',
    },
  ],
};

/** Auth disabled: every permission check passes. */
export const authDisabled: AuthCapabilities = { enabled: false, login: { type: 'credentials' } };

/** An authenticated user under RBAC holding exactly `permissions`. */
export const rbacUser = (permissions: string[]): AuthCapabilities => ({
  enabled: true,
  login: { type: 'credentials' },
  user: { id: 'user-1', email: 'user@example.com' },
  capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
  access: { roles: ['member'], permissions },
});
