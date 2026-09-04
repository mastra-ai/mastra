---
'@mastra/mcp': major
---

**Breaking:** MCP server metadata methods now return promises.

Before:

```ts
const info = server.getServerInfo();
```

After:

```ts
const info = await server.getServerInfo();
```

This lets CommonJS applications defer ESM-only ID normalization.
