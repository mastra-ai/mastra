import { Server } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';

// Write to stderr so tests can verify stderr piping
console.error('noisy-server: startup log');

const server = new Server({ name: 'Noisy Server', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler('tools/list', async () => ({
  tools: [],
}));

const transport = new StdioServerTransport();
await server.connect(transport);

export { server };
