---
'@mastra/mcp': minor
---

Added experimental support for subscribing to MCP server events (SEP-3415, a draft MCP extension). Servers that advertise the `io.modelcontextprotocol/events` extension can now be listed and subscribed to with `mcp.events`. The client picks push or poll delivery, resumes from a saved cursor, drops duplicate occurrences, and reopens subscriptions after reconnects.

```typescript
const subscription = await mcp.events.subscribe(
  'github',
  'repo.push',
  { repo: 'mastra-ai/mastra' },
  { cursor: savedCursor },
);

for await (const event of subscription) {
  await handlePush(event.data);
  await saveCursor(subscription.cursor);
}
```

This API is experimental and may change while SEP-3415 is a draft.
