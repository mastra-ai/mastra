---
'@mastra/temporal': patch
---

Added support for `foreach` concurrency resolver functions in the Temporal workflow runtime, matching the new `@mastra/core` behavior:

```ts
workflow
  .foreach(step, {
    concurrency: ({ inputData, getInitData }) => (getInitData().fast ? 10 : 1),
  })
  .commit();
```
