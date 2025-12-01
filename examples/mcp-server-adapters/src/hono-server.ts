import { serve } from '@hono/node-server';
import { MastraServer } from '@mastra/hono';
import { Hono } from 'hono';

import { mastra } from './mastra';

const PORT = 3001;

// Create Hono app
const app = new Hono();

// Add a simple health check endpoint
app.get('/', c => c.json({ status: 'ok', server: 'hono', message: 'Hono MCP Server is running' }));

// Create Mastra server adapter
const adapter = new MastraServer({
  app: app as any, // Type assertion needed due to Hono version differences
  mastra,
});

// Initialize all routes including MCP endpoints
adapter.init();

// Start the server
serve({
  fetch: app.fetch,
  port: PORT,
});

console.log(`Hono MCP Server running on port ${PORT}`);
