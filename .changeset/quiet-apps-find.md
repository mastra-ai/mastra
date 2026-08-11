---
'@mastra/mcp': patch
---

Expose MCP tool result content and metadata to UI consumers when structured output is returned.

```ts
import { getMcpCallToolResult } from '@mastra/mcp';

const result = await tool.execute(input);
const mcpResult = getMcpCallToolResult(result);
```
