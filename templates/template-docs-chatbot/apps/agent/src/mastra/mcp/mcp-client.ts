import { MCPClient } from '@mastra/mcp';

// Create an MCP client to connect to our local MCP server via HTTP/SSE
export const mcpClient = new MCPClient({
  servers: {
    // Connect to local MCP server via HTTP/SSE
    localTools: {
      url: new URL(process.env.MCP_SERVER_URL || 'http://localhost:4111/mcp'),
    },
  },
});
