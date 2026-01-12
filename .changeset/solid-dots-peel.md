---
'@mastra/core': minor
---

Add MCP tool annotations and metadata support to `ToolAction` and `Tool`

Tools can now surface UI hints like `title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint` via the new `annotations` field, and pass arbitrary metadata to MCP clients via `_meta`. The new `ToolAnnotations` type provides type-safe configuration for these hints.

```typescript
import { createTool } from '@mastra/core/tools';

const myTool = createTool({
  id: 'weather',
  description: 'Get weather for a location',
  annotations: {
    title: 'Weather Lookup',
    readOnlyHint: true,
    destructiveHint: false,
  },
  _meta: { version: '1.0.0' },
  execute: async ({ location }) => fetchWeather(location),
});
```
