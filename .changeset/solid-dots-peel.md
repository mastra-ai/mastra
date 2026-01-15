---
'@mastra/core': minor
---

Add MCP tool annotations and metadata support to `ToolAction` and `Tool`

Tools can now surface UI hints like `title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint` via the `mcp.annotations` field, and pass arbitrary metadata to MCP clients via `mcp._meta`. These MCP-specific properties are grouped under the `mcp` property to clearly indicate they only apply when tools are exposed via MCP.

```typescript
import { createTool } from '@mastra/core/tools';

const myTool = createTool({
  id: 'weather',
  description: 'Get weather for a location',
  mcp: {
    annotations: {
      title: 'Weather Lookup',
      readOnlyHint: true,
      destructiveHint: false,
    },
    _meta: { version: '1.0.0' },
  },
  execute: async ({ location }) => fetchWeather(location),
});
```
