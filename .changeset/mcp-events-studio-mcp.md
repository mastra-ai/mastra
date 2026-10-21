---
'@mastra/mcp': minor
---

`MCPServer` now exposes its declared events to Studio (experimental). `getEventsInfo()` returns the same descriptors as `events/list`, plus whether each type can be emitted. `getEventsInspector()` polls and streams an event type through the same code path as the `events/poll` and `events/stream` requests, and sends test events whose `eventId` starts with `mastra-test-`. The MCP wire protocol is unchanged.

```ts
const inspector = server.getEventsInspector();
const controller = new AbortController();

const { closed } = await inspector!.stream(
  'ticket.created',
  { arguments: { project: 'web' } },
  {
    signal: controller.signal,
    onFrame: frame => {
      if (frame.type === 'event') console.log(frame.occurrence.data);
    },
  },
);

controller.abort();
await closed;
```
