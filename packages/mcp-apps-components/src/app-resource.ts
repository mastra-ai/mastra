/** An MCP App resource: register it under a `ui://` URI in `MCPServer`'s `appResources`. */
export interface McpAppResource {
  name: string;
  description: string;
  html: string;
}
