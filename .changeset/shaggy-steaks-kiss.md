---
'@mastra/core': minor
---

Added `context.background.adopt()` so tools can return an acknowledgement while native background tasks track their existing operation through completion and cancellation.

Previously, background tools had to keep `execute()` pending:

```ts
execute: async (input, context) => {
  const operation = startResearch(input, context.abortSignal);
  return await operation.finished;
};
```

Tools can now adopt their operation during native background execution:

```ts
execute: async (input, context) => {
  const operation = startResearch(input, context.abortSignal);
  if (context.background) {
    context.background.adopt({
      completion: operation.finished,
      cancel: reason => operation.cancel(reason),
    });
    return { answer: 'Research started' };
  }
  return await operation.finished;
};
```

`startResearch` represents the tool's operation API. Its `finished` promise must resolve with the final tool result after cleanup, or reject on failure. Adopt once, before `execute()` returns. The handle stays in memory and cannot resume after a process restart.
