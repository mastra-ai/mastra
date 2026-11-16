import { Server } from '@modelcontextprotocol/server';
import type { Tool } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { EVENTS_EXTENSION_ID } from '../../../shared/events';
import { createEventsFixture } from './events-server';

// A stdio server offering MCP Events. Tests drive it through two tools: `emit` creates an
// occurrence, `stats` reports what the server observed.
const server = new Server(
  { name: 'Events Stdio Server', version: '1.0.0' },
  { capabilities: { tools: {}, extensions: { [EVENTS_EXTENSION_ID]: {} } } },
);
const fixture = createEventsFixture();
fixture.install(server);

const tools: Tool[] = [
  {
    name: 'emit',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string' }, arguments: { type: 'object' }, data: { type: 'object' } },
      required: ['name', 'data'],
    },
  },
  { name: 'stats', inputSchema: { type: 'object', properties: {} } },
];

server.setRequestHandler('tools/list', async () => ({ tools }));

server.setRequestHandler('tools/call', async request => {
  const args = request.params.arguments ?? {};
  if (request.params.name === 'emit') {
    const eventId = await fixture.emit(
      String(args.name),
      args.arguments as Record<string, unknown> | undefined,
      (args.data ?? {}) as Record<string, unknown>,
    );
    return { content: [{ type: 'text', text: eventId }] };
  }
  const stats = {
    liveStreams: fixture.liveStreams,
    closedStreams: fixture.closedStreams,
    streamRequests: fixture.streamRequests.length,
  };
  return { content: [{ type: 'text', text: JSON.stringify(stats) }], structuredContent: stats };
});

serveStdio(() => server, { legacy: 'reject' });
