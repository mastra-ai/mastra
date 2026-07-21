---
'@mastra/core': patch
---

Fixed `requestContext` typing in the dynamic `skills` agent option. When an agent defines `requestContextSchema`, the `skills` callback now receives a typed `RequestContext` (with key autocomplete and typo checking), matching `instructions`, `tools`, `memory`, and the other dynamic options. Previously it was always `RequestContext<unknown>`.

```typescript
const agent = new Agent({
  requestContextSchema: z.object({ documentId: z.string(), userId: z.string() }),
  // Before: requestContext was RequestContext<unknown> — any key compiled
  // After: requestContext is RequestContext<{ documentId: string; userId: string }>
  skills: ({ requestContext }) => {
    requestContext.get('documentId'); // typed as string
    return ['./skills/basic'];
  },
});
```

Fixes [#19553](https://github.com/mastra-ai/mastra/issues/19553)
