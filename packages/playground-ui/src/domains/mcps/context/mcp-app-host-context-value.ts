import { createContext, useContext } from 'react';

/** The MCP App instance a host callback is about: one tool call's app. */
export interface McpAppRef {
  /** Name of the MCP tool whose app this is */
  toolName: string;
  /** The chat tool call that rendered the app */
  toolCallId: string;
  /** The app's `ui://` resource URI */
  resourceUri: string;
}

/** `ui/update-model-context` params as the app sent them. Untrusted: parse before use. */
export interface McpAppModelContextParams {
  content?: unknown[];
  structuredContent?: Record<string, unknown>;
}

/** Lets a chat host extend the MCP Apps rendered in its tool cards. */
export interface McpAppHostValue {
  /** Extra host-context keys for this app instance; `theme` stays the viewer's own. */
  hostContext?: (app: McpAppRef) => Record<string, unknown> | undefined;
  /** Called with the raw params of every `ui/update-model-context` from this app instance. */
  onModelContext?: (app: McpAppRef, params: McpAppModelContextParams) => void;
}

export const McpAppHostContext = createContext<McpAppHostValue | null>(null);

export function useMcpAppHostContext() {
  return useContext(McpAppHostContext);
}
