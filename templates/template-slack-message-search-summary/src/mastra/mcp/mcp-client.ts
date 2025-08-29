import { MCPClient } from '@mastra/mcp';

// Create an MCP client to connect to external Slack MCP server
export const mcpClient = new MCPClient({
  servers: {
    // Connect to external Slack MCP server
    slackTools: {
      url: new URL(process.env.SLACK_MCP_SERVER_URL || 'http://localhost:3001'),
    },
  },
});