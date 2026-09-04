---
'@mastra/core': major
---

**Breaking:** MCP ID lookups now return promises.

Before:

```ts
const server = mastra.getMCPServerById('my-server');
```

After:

```ts
const server = await mastra.getMCPServerById('my-server');
```

CommonJS entry points now defer ESM-only runtime dependencies until they are needed.
