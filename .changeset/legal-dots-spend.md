---
'@mastra/memory': minor
---

Added usage data to ObserveHooks callbacks. onObservationEnd and onReflectionEnd now receive a result object containing token usage from the underlying LLM call. This enables reliable usage tracking across all observation and reflection paths (sync, async buffered, and resource-scoped).

**Example**

```ts
await memory.observe({
  threadId,
  messages,
  hooks: {
    onObservationEnd: ({ usage }) => {
      // usage: { inputTokens, outputTokens, totalTokens }
      console.log('Observation tokens:', usage);
    },
    onReflectionEnd: ({ usage }) => {
      console.log('Reflection tokens:', usage);
    },
  },
});
```

Existing callbacks that accept no arguments continue to work without changes.
