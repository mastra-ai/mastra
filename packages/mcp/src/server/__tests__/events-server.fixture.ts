import { createTool } from '@mastra/core/tools';
import { z } from 'zod/v4';

import { defineEvent } from '../events';
import { MCPServer } from '../server';

let server: MCPServer;

const emitTicket = createTool({
  id: 'emitTicket',
  description: 'Emits a ticket.created event',
  inputSchema: z.object({ id: z.string(), project: z.string() }),
  execute: async ticket => {
    const occurrence = await server.events.emit('ticket.created', ticket);
    return occurrence.eventId;
  },
});

const echo = createTool({
  id: 'echo',
  description: 'Echoes the input back',
  inputSchema: z.object({ text: z.string() }),
  execute: async ({ text }) => text,
});

server = new MCPServer({
  name: 'Events Server',
  version: '1.0.0',
  tools: { emitTicket, echo },
  events: {
    'ticket.created': defineEvent({
      description: 'A ticket was created',
      inputSchema: z.object({ project: z.string().optional() }),
      payloadSchema: z.object({ id: z.string(), project: z.string() }),
      match: (args, data) => !args.project || data.project === args.project,
    }),
  },
  requestState: { key: 'fixture-key-fixture-key-fixture-key-1234' },
});

await server.startStdio();
