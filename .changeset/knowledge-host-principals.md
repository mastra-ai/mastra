---
'@mastra/core': minor
---

Added `principals` and `author` options to `knowledge.createTools()`, and `knowledge.getPinnedContext({ principals })`. A host can now run the Knowledge tools and read pinned pages outside an agent run, for example from an MCP server acting for an external agent. Every call reads and writes under those fixed principals, following the same scope rules as an agent, and writes are recorded under `author`. Principals must match a declared scope type and must come from the host, never from the request.

```ts
const tools = knowledge.createTools({
  read: true,
  write: true,
  principals: ['agent:claude-code'],
  author: 'user:123 via mcp:claude-code',
});
```
