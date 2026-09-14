---
'@mastra/core': minor
---

Prepared `MCPServerBase` for MCP 2026-07-28 servers while preserving MCP 1.x contexts. `startSSE` and `startHonoSSE` are now optional (only `@mastra/mcp` 1.x implements the standalone SSE transport), a server can set `mcpVersion` to `2`, and `executeTool` on such a server resolves to the new `MCPToolExecutionResultV2`, which reports a suspended tool instead of a bare result. Existing 1.x servers need no new properties.

The 1.x-only surfaces are now `@deprecated` and will be removed in the next core major: `startSSE`, `startHonoSSE`, `MCPServerSSEOptions`, `MCPServerHonoSSEOptions`, `MCPServerHTTPOptions.options`, `MCPServerContext`, `MCPToolExecutionContext` and `context.mcp`.

Tools that need input mid-execution use the suspend/resume primitives `createTool` already has. On a 2026-07-28 server they receive `context.mcpv2` with per-request `log`, `progress`, `metadata`, `signal`, `suspend`, `resumeData`, and the new `suspendPayload`:

```ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const confirm = createTool({
  id: 'confirm',
  description: 'Ask for confirmation',
  inputSchema: z.object({ amount: z.number() }),
  outputSchema: z.boolean(),
  suspendSchema: z.object({ phase: z.literal('confirm'), amount: z.number() }),
  resumeSchema: z.object({ confirmed: z.boolean() }),
  execute: async ({ amount }, context) => {
    const round = context.mcpv2;
    if (!round?.resumeData) {
      await round?.suspend({ phase: 'confirm', amount });
      return;
    }
    return round.resumeData.confirmed;
  },
});
```

`suspendPayload` is now also handed back to tools resumed by agents and workflows. The legacy `context.mcp` type is untouched; `mcpv2` becomes `mcp` in the next core major.
