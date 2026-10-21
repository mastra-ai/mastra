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

`match` filters by the arguments a client chooses. To restrict who can subscribe, add an `authorize` function: it receives the arguments and the caller's `requestContext`, and returning `false` rejects the poll or stream with `-32024`.

Event types without a `poll` function are served over push and poll from an in-memory buffer, so clients can resume from a cursor. Event types with a `poll` function are served over poll only and can't be emitted to. Emitted events only reach subscribers of the same server process. Changes to the list of event types aren't announced yet (a limitation of the MCP TypeScript SDK 2.2.0), so clients should re-run `events/list` to see them.
