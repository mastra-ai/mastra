---
'@mastra/mcp': minor
---

Added MCP tool annotations to the `requireToolApproval` context and exposed them on tools returned from `listTools()` / `listToolsets()`.

The `requireToolApproval` callback now receives the server-advertised `annotations` (`title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) alongside `toolName` and `args`. This lets you write declarative approval policies instead of hardcoding tool name lists. Annotations are also propagated onto Mastra tools as `tool.mcp.annotations` so apps can render them in UI.

**Security caveat (per the MCP spec):** annotations are _hints_, not guarantees. Clients MUST treat them as untrusted unless they come from a trusted server. Do not use annotations alone as a security boundary for servers you do not control — set `requireToolApproval: true` for those. When the server omits annotations entirely, this field is `undefined`, so policies can distinguish "no annotations" from "annotated as safe".

```ts
import { MCPClient } from '@mastra/mcp';

// Before — hardcoded tool name lists, server-specific
const mcp = new MCPClient({
  servers: {
    github: {
      url: new URL('https://example.com/mcp'),
      requireToolApproval: ({ toolName }) => toolName === 'delete_repo',
    },
  },
});

// After — annotation-driven, works across any trusted MCP server
const mcp = new MCPClient({
  servers: {
    github: {
      url: new URL('https://example.com/mcp'),
      requireToolApproval: ({ annotations }) => {
        if (!annotations) return true;
        if (annotations.readOnlyHint) return false;
        if (annotations.destructiveHint) return true;
        return false;
      },
    },
  },
});

// Annotations are also visible on tools returned by listTools()
const tools = await mcp.listTools();
for (const tool of Object.values(tools)) {
  console.log(tool.mcp?.annotations);
}
```

Closes #16766.
