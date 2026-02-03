---
"@mastra/client-js": patch
---

Fixed client-side tools using plain JSON Schema objects causing OpenAI to reject requests with "Invalid schema" errors.

**What changed:** The `processClientTools` function now correctly handles both Vercel AI SDK tools (with `parameters` field) and Mastra tools (with `inputSchema`/`outputSchema` fields), preserving plain JSON Schemas without modification.

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
