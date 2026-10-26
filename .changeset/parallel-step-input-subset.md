---
'@mastra/core': patch
---

Fixed a TypeScript error when passing steps to `.parallel()` whose `inputSchema` only uses part of the previous step's output. `.parallel()` now accepts the same steps as `.then()`: the previous output only has to include the fields each step needs. Steps that need a field the previous output doesn't have are still rejected. Runtime behavior is unchanged.

```ts
const workflow = createWorkflow({ ... })
  .then(producesValueAndPrompt) // outputs { value: number; prompt: string }
  .parallel([readsValue, readsPrompt]); // inputs { value: number } and { prompt: string } — now type-checks
```
