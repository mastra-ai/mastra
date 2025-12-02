import { MastraServer } from '@mastra/express';
import express from 'express';

import { mastra } from './mastra';

const PORT = 3002;

// Create Express app
const app = express();

// Add JSON body parser middleware
// This tests that MCP endpoints work correctly with express.json() middleware
app.use(express.json());

// Add a simple health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', server: 'express', message: 'Express MCP Server is running' });
});

// Create Mastra server adapter
const adapter = new MastraServer({
  app,
  mastra,
});

// Initialize all routes including MCP endpoints
adapter.init();

// Start the server
app.listen(PORT, () => {
  console.log(`Express MCP Server running on port ${PORT}`);
});
