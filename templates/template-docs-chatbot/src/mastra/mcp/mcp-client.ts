import { MCPClient } from '@mastra/mcp';

export const mcpClient = new MCPClient({
  servers: {
    // Connect to local MCP server via SSE
    localTools: {
      url: new URL(process.env.MCP_SERVER_URL || 'http://localhost:4112/sse'),
    },
  },
});
