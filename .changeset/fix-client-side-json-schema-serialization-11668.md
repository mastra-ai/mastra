---
"@mastra/client-js": patch
"@mastra/core": patch
"@mastra/schema-compat": patch
---

Fixed client-side tools using plain JSON Schema objects causing OpenAI to reject requests with "Invalid schema" errors.

**What changed:** Client-side tools can now use plain JSON Schema objects directly without errors when calling OpenAI models.

**Example:**
```typescript
const tool = {
  name: 'searchTool',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' }
    }
  },
  execute: async (input) => { /* ... */ }
};
// Previously failed with "Invalid schema" error from OpenAI
```

Fixes #11668
