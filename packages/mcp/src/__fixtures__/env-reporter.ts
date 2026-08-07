import { Server } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';

const server = new Server({ name: 'Env Reporter', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'getEnvKeys',
      description: 'Returns Object.keys(process.env)',
      inputSchema: { type: 'object', properties: {} },
    },
  ],
}));

server.setRequestHandler('tools/call', async () => ({
  content: [{ type: 'text', text: JSON.stringify(Object.keys(process.env)) }],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
