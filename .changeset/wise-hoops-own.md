---
'@mastra/core': minor
---

Added MCP 2026-07-28 server contracts to `MCPServerBase` while keeping MCP 1.x servers working unchanged.

- Added `mcpVersion` to `MCPServerBase`. A server that sets it to `2` resolves `executeTool` to `MCPToolExecutionResultV2`, which reports a suspended tool (`{ status: 'suspended', suspendPayload, resumeSchema }`) instead of a bare result. Thrown errors and schema failures still reject. Existing 1.x servers need no new properties.
- Added `context.mcp.protocolVersion`, set to `'2026-07-28'` by 2.x servers. `context.mcp.extra`, `log` and `progress` keep the same shape on both server versions.
- Added `suspend`, `resumeData` and `suspendPayload` at the top level of the tool execution context for direct and MCP 2.x execution. Agents and workflows keep nesting them under `agent` and `workflow` until the next core major.
- Added `suspendPayload` to tools resumed by agents (including durable agents) and workflows, alongside `resumeData`.
- Deprecated the surfaces MCP 2026-07-28 removed, for removal in the next core major: `startSSE`, `startHonoSSE`, `MCPServerSSEOptions`, `MCPServerHonoSSEOptions`, `MCPServerHTTPOptions.options`, `context.mcp.elicitation.sendRequest`, `context.mcp.extra.sendRequest` and `context.mcp.extra.sendNotification`. On a 2.x server the deprecated `context.mcp` members throw with a message naming the replacement. `startSSE` and `startHonoSSE` are no longer abstract, so 2.x servers do not implement them.

Tools that need input mid-execution use the suspend/resume primitives `createTool` already has:

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
