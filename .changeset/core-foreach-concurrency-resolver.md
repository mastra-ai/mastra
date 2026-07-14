---
'@mastra/core': minor
---

Added support for resolving `foreach` concurrency at execution time. `concurrency` can now be a function that receives the foreach input and the workflow's init data and returns a number, in addition to a static number:

```ts
workflow.foreach(step, {
  concurrency: ({ inputData, getInitData }) => (getInitData().fast ? 10 : 1),
});
```

Durable agents use this to honor `toolCallConcurrency`: parallel tool calls now run concurrently (default 10) instead of always sequentially, while runs that require tool approval or use tools that can suspend still execute tool calls one at a time.
