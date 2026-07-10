---
'@mastra/schema-compat': patch
---

Fixed OpenAI tool and structured-output requests failing when a schema used `z.record(...)`. The record emits a `propertyNames` JSON Schema keyword, which OpenAI Structured Outputs strict mode rejects, so the whole request was returning an "Invalid schema" error. The OpenAI compatibility layer now strips `propertyNames` (as the Google layer already did), so record fields work again.

**Before**

```ts
// Rejected by OpenAI: schema still contained `propertyNames`.
const tool = createTool({
  inputSchema: z.object({ metadata: z.record(z.string(), z.string()) }),
  // ...
});
```

**After**

The same schema is accepted. This covers both standard OpenAI models and OpenAI reasoning models, which share the same compatibility layer.
