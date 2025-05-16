import { MCPClient } from '@mastra/mcp';

async function main() {
  const mcpClient = new MCPClient({
    servers: {
      myMcpServer: {
        url: new URL('http://localhost:4111/api/mcp/myMcpServer/mcp'),
      },
    },
  });

  const tools = await mcpClient.getTools();
  console.log('Tools:', tools);
}

main();
