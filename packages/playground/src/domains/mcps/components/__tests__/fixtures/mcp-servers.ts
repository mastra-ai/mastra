import type { McpServerInfo, McpServerToolListResponse, McpToolInfo } from '@mastra/client-js';
import type { AuthCapabilities } from '@/domains/auth/types';

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

export const emptyToolList: McpServerToolListResponse = { tools: [] };

/** Auth disabled: every permission check passes. */
export const authDisabled: AuthCapabilities = { enabled: false, login: { type: 'credentials' } };
