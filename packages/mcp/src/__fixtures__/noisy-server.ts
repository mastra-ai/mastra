import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Write to stderr so tests can verify stderr piping
console.error('noisy-server: startup log');

const server = new Server({ name: 'Noisy Server', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [],
}));

const transport = new StdioServerTransport();
await server.connect(transport);

export { server };
