/**
 * Structurally an `AppResource` from `@mastra/mcp`, so it drops into `MCPServer`'s `appResources`.
 */
export type McpAppResource = {
  name: string;
  description: string;
  htmlPath: string;
};
