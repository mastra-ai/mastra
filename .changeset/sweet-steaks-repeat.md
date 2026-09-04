---
'@mastra/core': major
'@mastra/deployer': patch
'@mastra/editor': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/code-sdk': patch
'mastracode': patch
'@mastra/mcp': patch
---

**Breaking:** MCP ID lookups now return promises, and CommonJS applications safely defer ESM-only runtime dependencies.

Before:

```ts
const server = mastra.getMCPServerById('my-server');
```

After:

```ts
const server = await mastra.getMCPServerById('my-server');
```

This prevents CommonJS startup failures caused by ESM-only dependencies.
