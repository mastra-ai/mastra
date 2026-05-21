---
"@mastra/core": minor
---

Added: Harness sessions now expose a read-only `actions` catalog that aggregates skill action metadata and MCP tool descriptors for desktop command palettes without adding execution or lifecycle controls.

MCP action discovery uses workspace-scoped cache keys when a workspace is already available, and MCP action reads do not provision a workspace just to build the catalog.

```ts
const actions = await session.actions.list({ query: 'ticket', limit: 20 });
const mcpActions = await session.actions.search('workspace', { source: 'mcp-tool' });
await session.actions.refresh();
```
