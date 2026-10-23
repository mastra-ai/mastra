---
'@mastra/mcp': minor
---

Added optional type generation for direct MCP tool calls. Generate concrete input/output interfaces from your existing clients without changing dynamic discovery or execution.

Before:

```ts
export const mcp = new MCPClient({ servers });
```

After:

```ts
import { MCPClient } from '@mastra/mcp';
import type { MCPServers } from './mcp-types.generated';

export const mcp = new MCPClient<MCPServers>({
  servers,
  typegen: { outFile: 'mcp-types.generated.ts' },
});
```

Run `npx @mastra/mcp generate ./client.ts` with the required server credentials. The generated type-only import can be absent on the first run. File paths resolve from the command working directory. Regenerate when server schemas change.

Discovered tools remain optional. Results retain protocol-envelope and validation-error alternatives; absent output schemas use `unknown`. Narrow results before accessing structured fields.
