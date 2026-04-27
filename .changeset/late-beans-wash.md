---
'@mastra/core': patch
---

Fixed type checking for workflow `map()` and `then()` outputs — `commit()` now rejects at compile time when the final step's output doesn't satisfy the workflow's `outputSchema`. Closes #15732.

**Before:** TypeScript allowed committing a workflow whose last `map()` returned a value incompatible with `outputSchema`, leading to runtime errors. Object-style `map({ key: { step, path } })` also silently bypassed the check via a bare `any` return type.

```ts
const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ summary: z.string(), items: z.array(z.string()) }),
})
  .map(async () => 123) // No compile error — bug discovered at runtime
  .commit();
```

**After:** `commit()` produces a compile-time error when the final output type is incompatible. Object-style `map({...})` uses an opaque `ObjectMapOutput` brand instead of `any`, so it correctly allows `commit()` without leaking `any` through the rest of the type system.

```ts
const workflow = createWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ summary: z.string(), items: z.array(z.string()) }),
})
  .map(async () => 123)
  .commit(); // TS error: final output does not satisfy outputSchema
```
