---
'@mastra/mcp': minor
---

Added experimental MCP Events support to `MCPServer`. Clients can now subscribe to events your server publishes, such as a ticket being created, by polling (`events/poll`) or by keeping a stream open (`events/stream`). This implements the draft SEP-3415 extension, so the API and wire format may change.

```ts
import { MCPServer, defineEvent } from '@mastra/mcp';
import { z } from 'zod';

const server = new MCPServer({
  id: 'tickets',
  name: 'Tickets',
  version: '1.0.0',
  tools: {},
  events: {
    'ticket.created': defineEvent({
      description: 'A ticket was created',
      inputSchema: z.object({ project: z.string().optional() }),
      payloadSchema: z.object({ id: z.string(), project: z.string() }),
      match: (args, data) => !args.project || data.project === args.project,
    }),
  },
});

await server.events.emit('ticket.created', { id: 't-1', project: 'web' });
```

Event types without a `poll` function are served from an in-memory buffer, so clients can resume from a cursor. Emitted events only reach subscribers of the same server process.
