import { createTool } from '@mastra/core/tools';
import { MCPServer, defineEvent } from '@mastra/mcp';
import { z } from 'zod';

const ticket = z.object({ id: z.string(), project: z.string(), title: z.string() });

const openTicket = createTool({
  id: 'openTicket',
  description: 'Opens a support ticket',
  inputSchema: ticket,
  execute: async input => {
    // Every new ticket becomes a `ticket.created` occurrence for matching subscribers.
    const occurrence = await server.events.emit('ticket.created', input);
    return { eventId: occurrence.eventId };
  },
});

const server: MCPServer = new MCPServer({
  id: 'tickets',
  name: 'Tickets',
  version: '1.0.0',
  tools: { openTicket },
  events: {
    'ticket.created': defineEvent({
      description: 'A support ticket was opened',
      inputSchema: z.object({ project: z.string() }),
      payloadSchema: ticket,
      match: (args, data) => data.project === args.project,
    }),
  },
});

await server.startStdio();
