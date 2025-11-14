#!/usr/bin/env tsx

import { MCPServer } from '@mastra/mcp';
import { docsTool } from './tools/docs-tool';
import { config } from 'dotenv';

config();

// Create MCP server with tools for HTTP/SSE transport
const mcpServer = new MCPServer({
  name: 'Kepler docs MCP server',
  version: '1.0.0',
  description: 'Provides access to documentation and planet information tools via HTTP/SSE',

  // Expose individual tools
  tools: {
    docsTool,
  },
});

// Function to start the server via HTTP/SSE
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
