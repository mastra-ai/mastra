---
'@mastra/core': patch
---

Fixed `createTool` so that the `execute` callback's `inputData` parameter is properly inferred from `inputSchema` without requiring an explicit type annotation.

Previously, TypeScript could not resolve the contextual type for `inputData` because `InferSchema<TInputSchema>` is a deferred conditional type — evaluated while `TInputSchema` itself is still being inferred from the object literal. This caused `inputData` to silently fall back to `any`, losing all type safety inside the callback body.

**Before:**
```ts
const tool = createTool({
  inputSchema: z.object({ name: z.string() }),
  execute: async (inputData) => {
    inputData.this_does_not_exist; // no TS error — inputData was `any`
  },
});
```

**After:**
```ts
const tool = createTool({
  inputSchema: z.object({ name: z.string() }),
  execute: async (inputData) => {
    inputData.this_does_not_exist; // TS error: Property does not exist
    inputData.name; // string ✓
  },
});
```

The fix adds an overload for `createTool` where `inputSchema: PublicSchema<TIn>` binds `TIn` as a concrete type parameter, giving TypeScript a non-deferred type to use when contextually typing `execute`.
