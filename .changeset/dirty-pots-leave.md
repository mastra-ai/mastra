---
'@mastra/core': patch
---

Fixed `requestContext` typing inside a tool's `execute` callback. It is now non-optional, matching runtime behavior: Mastra always provides a `RequestContext` (creating an empty one when the caller passed none), and when `requestContextSchema` is defined the context is validated before `execute` runs — on failure the tool returns a validation error and `execute` is never called. No more null-checks, throws, or tool factories needed to satisfy the compiler.

```typescript
const tool = createTool({
  id: 'fetch-doc',
  requestContextSchema: z.object({ documentId: z.string(), userId: z.string() }),
  execute: async (input, context) => {
    // Before: context.requestContext was RequestContext<...> | undefined,
    // forcing ?. / ! / throw even though the runtime guarantees it exists
    // After: typed as RequestContext<{ documentId: string; userId: string }>
    const documentId = context.requestContext.get('documentId'); // string
  },
});
```

Callers of `tool.execute(...)` are unaffected — passing a context remains optional there. Fixes [#19480](https://github.com/mastra-ai/mastra/issues/19480)
