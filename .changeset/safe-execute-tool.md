---
'@mastra/core': minor
---

Added `safeExecuteTool` utility for safely calling one tool from within another tool's `execute` function.

```typescript
import { createTool, safeExecuteTool } from '@mastra/core/tools';

const compositeTool = createTool({
  id: 'composite-tool',
  execute: async (input, context) => {
    const result = await safeExecuteTool(otherTool, { query: 'test' }, context);
    if (!result) return { error: 'inner tool failed' };
    return { data: result };
  },
});
```

- Returns `null` on failure instead of throwing, so one tool's error won't crash the parent
- Detects circular/deeply nested calls and aborts at a configurable max depth (default: 10)
- Propagates `requestContext`, `tracingContext`, `abortSignal`, and `writer` to nested tools
- Automatically creates child tracing spans for observability of nested tool calls
