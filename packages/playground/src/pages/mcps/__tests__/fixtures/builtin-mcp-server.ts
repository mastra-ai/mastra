import type { GetBuiltinMcpServerResponse, McpServerListResponse } from '@mastra/client-js';

/** Default `mastra dev` server: no `server.auth`, so the server is open for local use only. */
export const openDevServer: GetBuiltinMcpServerResponse = {
  enabled: true,
  path: '/api/mcp',
  mcpPackageInstalled: true,
  toolsets: ['agents', 'workflows', 'tools', 'observability_analytics'],
  readOnly: false,
  auth: { type: 'open', devOnly: true },
};

/** `server.mcp.enabled: true` without `server.auth`: open outside `mastra dev` too. */
export const openEverywhereServer: GetBuiltinMcpServerResponse = {
  ...openDevServer,
  auth: { type: 'open', devOnly: false },
};

export const protectedServer: GetBuiltinMcpServerResponse = {
  ...openDevServer,
  readOnly: true,
  auth: { type: 'protected', provider: 'clerk' },
};

/** A plain `MastraAuthConfig` has no provider name. */
export const protectedUnnamedServer: GetBuiltinMcpServerResponse = {
  ...openDevServer,
  auth: { type: 'protected', provider: null },
};

/** `server.mcp.path: '/tools-mcp'` behind `apiPrefix: '/mastra'`. */
export const customPathServer: GetBuiltinMcpServerResponse = {
  ...openDevServer,
  path: '/mastra/tools-mcp',
};

export const missingPackageServer: GetBuiltinMcpServerResponse = {
  ...openDevServer,
  mcpPackageInstalled: false,
};

export const disabledByConfig: GetBuiltinMcpServerResponse = { enabled: false, disabledReason: 'config' };

export const disabledInProduction: GetBuiltinMcpServerResponse = {
  enabled: false,
  disabledReason: 'production-without-auth',
};

export const noUserServers: McpServerListResponse = { servers: [], next: null, total_count: 0 };

export const oneUserServer: McpServerListResponse = {
  servers: [
    {
      id: 'notes',
      name: 'Notes MCP',
      version_detail: { version: '1.0.0', release_date: '2026-07-28T00:00:00Z', is_latest: true },
      transports: ['streamable-http'],
    },
  ],
  next: null,
  total_count: 1,
};
