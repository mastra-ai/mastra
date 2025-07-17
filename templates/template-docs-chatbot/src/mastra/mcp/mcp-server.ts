import { MCPServer } from '@mastra/mcp';
import { planetsInfoTool } from '../tools/planets-tool';

import { config } from 'dotenv';
config();

// Create MCP server with tools and agents for HTTP/SSE transport
export const mcpServer = new MCPServer({
  name: 'Template Docs Chatbot MCP Server',
  version: '1.0.0',
  description: 'Provides access to documentation, planet information tools and intelligent agents via HTTP/SSE',

  // Expose individual tools
  tools: {
    planetsInfoTool,
  },
});

// Export a function to start the server via HTTP/SSE manually
export async function startHttpServer(port: number = 4111) {
  const { createServer } = await import('http');

  const baseUrl = process.env.SERVER_BASE_URL || `http://localhost:${port}`;

  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url || '', baseUrl);

    // Handle CORS for web clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    await mcpServer.startSSE({
      url,
      ssePath: '/mcp',
      messagePath: '/mcp/message',
      req,
      res,
    });
  });

  httpServer.listen(port, () => {
    console.log(`MCP server running on ${baseUrl}/mcp`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down MCP server...');
    await mcpServer.close();
    httpServer.close(() => {
      console.log('MCP server shut down complete');
      process.exit(0);
    });
  });

  return httpServer;
}

// If this file is run directly, start the HTTP server
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.env.MCP_PORT || '4111', 10);
  startHttpServer(port).catch(console.error);
}
