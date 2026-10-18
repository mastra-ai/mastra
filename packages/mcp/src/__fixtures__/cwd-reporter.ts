import { Server } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';

const server = new Server({ name: 'CWD Reporter', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler('tools/list', async () => ({
  tools: [{ name: 'getCwd', description: 'Returns process.cwd()', inputSchema: { type: 'object', properties: {} } }],
}));

server.setRequestHandler('tools/call', async () => ({
  content: [{ type: 'text', text: process.cwd() }],
}));

serveStdio(() => server, { legacy: 'reject' });
