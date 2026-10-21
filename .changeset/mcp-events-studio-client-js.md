---
'@mastra/client-js': minor
---

Added experimental methods for MCP server events:

```ts
const { events } = await client.getMcpServerEvents('tickets');
const { events: occurrences, cursor } = await client.pollMcpServerEvent('tickets', 'ticket.created', {
  arguments: { project: 'web' },
});

const controller = new AbortController();
for await (const frame of client.streamMcpServerEvent(
  'tickets',
  'ticket.created',
  { cursor },
  { signal: controller.signal },
)) {
  if (frame.type === 'event') console.log(frame.occurrence.data);
}

// Under `mastra dev` only
await client.emitMcpServerEvent('tickets', 'ticket.created', { title: 'Test ticket' });
```
