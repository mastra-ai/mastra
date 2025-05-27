import { MCPServer } from '../server/server';
import { weatherTool } from './tools';

const server = new MCPServer({
  name: 'My MCP Server',
  version: '1.0.0',
  tools: {
    weatherTool,
  },
});

server.startStdio().catch(error => {
  const errorMessage = 'Fatal error running server';
  console.error(errorMessage, error);
  process.exit(1);
});
