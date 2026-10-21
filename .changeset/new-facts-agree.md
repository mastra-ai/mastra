---
'@mastra/factory': minor
---

Made the Factory MCP server work with Claude's custom connectors and browser MCP clients, and added experimental activity events.

**Works with Claude and browser clients.** Browser-based MCP clients can now call the endpoint from an allowed origin and read its sign-in challenge. The server tells clients what a Factory is and which tools to start with. `/web/config/features` now reports `mcp: true` when the Factory serves its MCP endpoint.

**Follow Factory activity (experimental).** MCP clients can poll a `factory.activity` event to see work item changes. Pass a `workItemId` or `actions` to narrow it. It covers work item activity only and is delivered by polling only.

```json
{
  "method": "events/poll",
  "params": { "name": "factory.activity", "arguments": { "workItemId": "<id>" }, "cursor": null }
}
```

Start with `cursor: null` and pass back the returned `cursor` on each poll.

The endpoint speaks MCP 2026-07-28. Older clients that open with `initialize` get an unsupported-version error.
