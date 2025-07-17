#!/usr/bin/env tsx

import { startHttpServer } from '../mastra/mcp/mcp-server.js';

// Get port from environment or default to 4111 (different from Mastra's 4112)
const port = parseInt(process.env.MCP_PORT || '4111', 10);

console.log('Starting MCP server via HTTP/SSE...');

// Start the MCP server via HTTP/SSE
startHttpServer(port).catch(error => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
