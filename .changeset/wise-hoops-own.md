---
'@mastra/core': minor
---

Prepared `MCPServerBase` for MCP 2026-07-28 servers while preserving MCP 1.x contexts. `startSSE` and `startHonoSSE` are now optional (only `@mastra/mcp` 1.x implements the standalone SSE transport), a server can set `mcpVersion` to `2`, and `executeTool` on such a server resolves to the new `MCPToolExecutionResultV2`, which reports a suspended tool instead of a bare result. Existing 1.x servers need no new properties.

`context.mcp` keeps one shape for both server versions: `extra` (`signal`, `requestId`, `authInfo`, `_meta`), `log` and `progress` work the same everywhere, and a 2026-07-28 server also sets `context.mcp.protocolVersion`. The members the 2026-07-28 protocol removed are now `@deprecated` and throw on a 2.x server with a message naming the replacement: `elicitation.sendRequest`, `extra.sendRequest` and `extra.sendNotification`. `startSSE`, `startHonoSSE`, `MCPServerSSEOptions`, `MCPServerHonoSSEOptions` and `MCPServerHTTPOptions.options` are `@deprecated` too; all of these are removed in the next core major.

Tools that need input mid-execution use the suspend/resume primitives `createTool` already has. `suspend`, `resumeData` and the new `suspendPayload` are now typed at the top level of the tool context for direct and MCP 2.x execution (agents and workflows keep nesting them under `agent`/`workflow` until the next core major):

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
    await context.mcp?.log?.('info', 'asking for confirmation', { amount });
    if (!context.resumeData) {
      await context.suspend?.({ phase: 'confirm', amount });
      return;
    }
    return context.resumeData.confirmed;
  },
});
```

`suspendPayload` is now also handed back to tools resumed by agents and workflows.
