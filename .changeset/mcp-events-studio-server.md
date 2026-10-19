---
'@mastra/server': minor
---

Added experimental routes for inspecting MCP server events:

- `GET /mcp/:serverId/events` lists the server's event types.
- `POST /mcp/:serverId/events/:eventName/poll` polls an event type.
- `POST /mcp/:serverId/events/:eventName/stream` streams occurrences as server-sent events until the client disconnects.
- `POST /mcp/:serverId/events/:eventName/emit` sends a test event. It only exists under `mastra dev`; elsewhere it returns 404.

MCP server list and detail responses include `events_capability: true` when the server declares events. Errors return generic messages; details are logged on the server.
