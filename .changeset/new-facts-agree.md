---
'@mastra/factory': minor
---

Made the Factory MCP server work with Claude's custom connectors and browser MCP clients, and added experimental activity events.

**Works with Claude and browser clients.** Browser-based MCP clients can now call the endpoint and read its sign-in challenge. The server tells clients what a Factory is and which tools to start with. `/web/config/features` now reports `mcp: true` when the Factory serves its MCP endpoint.

**Follow Factory activity (experimental).** MCP clients can poll a `factory.activity` event to see work item and session activity. Pass a `workItemId` or `actions` to narrow it. Work item activity always shows up. When it happened in another member's private session it is marked `privateSession: true` without naming the session, and activity on that session alone is left out. Events are delivered by polling only, so Claude and ChatGPT don't use it yet.

```json
{
  "method": "events/poll",
  "params": { "name": "factory.activity", "arguments": { "workItemId": "<id>" }, "cursor": null }
}
```

Start with `cursor: null` and pass back the returned `cursor` on each poll.

The endpoint speaks MCP 2026-07-28, and also serves clients that still open with `initialize` (such as VS Code and Cursor) statelessly.
