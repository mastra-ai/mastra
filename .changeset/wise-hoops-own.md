---
'@mastra/core': minor
---

Added the MCP v2 server and registry contracts while preserving MCP 1.x contexts. `MCPServerRegistryEntry` accepts `MCPServerBase` and the new `MCPServerBaseV2`; existing 1.x servers need no new properties.

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
