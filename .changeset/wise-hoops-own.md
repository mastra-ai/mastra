---
'@mastra/core': minor
---

Added independent MCP v2 tool and server contracts while preserving MCP 1.x contexts. Native tools validate completed output separately from input-required control and cannot enter agent or workflow business-tool registries.

Existing business tools continue to use `createTool`. Protocol-aware tools use the new core factory:

```ts
import { createMCPTool } from '@mastra/core/mcp';
import { z } from 'zod';

const count = createMCPTool({
  id: 'count',
  description: 'Count items',
  inputSchema: z.object({ items: z.array(z.string()) }),
  outputSchema: z.number(),
  execute: ({ items }) => ({ kind: 'completed', value: items.length }),
});
```

Register native tools only on an MCP v2 server. Existing MCP 1.x servers remain supported.
