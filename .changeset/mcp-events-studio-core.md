---
'@mastra/core': minor
---

Added optional, experimental `getEventsInfo()` and `getEventsInspector()` members to `MCPServerBase`, plus the event info types (`MCPServerEventInfo`, `MCPServerEventStreamFrame`, `MCPServerEventsInspector`, …) and `MCP_SERVER_EVENT_ERROR_IDS`. Servers that declare MCP events use them to let Studio list, poll, stream and test-emit their event types. Servers without events don't need to implement them.

```ts
const info = server.getEventsInfo?.();
console.log(info?.events.map(event => event.name));

const inspector = server.getEventsInspector?.();
const { events, cursor } = await inspector!.poll('ticket.created', { arguments: { project: 'web' } });
```
