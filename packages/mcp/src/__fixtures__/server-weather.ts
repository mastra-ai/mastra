import { createMCPServer } from '../server';
import { weatherTool } from './tools';

const { startStdio } = createMCPServer({
  name: 'My MCP Server',
  version: '1.0.0',
  tools: {
    weatherTool,
  },
});

startStdio().catch(error => {
  const errorMessage = 'Fatal error running server';
  console.error(errorMessage, error);
  process.exit(1);
});
