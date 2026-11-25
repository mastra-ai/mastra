import type { ReactNode } from 'react';

import { McpAppHostContext } from './mcp-app-host-context-value';
import type { McpAppHostValue } from './mcp-app-host-context-value';

/** Extends the MCP Apps rendered in the chat's tool cards; see `McpAppHostValue`. */
export function McpAppHostProvider({ value, children }: { value: McpAppHostValue; children: ReactNode }) {
  return <McpAppHostContext.Provider value={value}>{children}</McpAppHostContext.Provider>;
}
