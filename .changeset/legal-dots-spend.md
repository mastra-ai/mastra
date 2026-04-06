---
'@mastra/memory': minor
---

Added usage data to ObserveHooks callbacks and standalone reflect() return.

**ObserveHooks:** `onObservationEnd` and `onReflectionEnd` now receive a result object containing token usage from the underlying LLM call. This enables reliable usage tracking across all observation and reflection paths (sync, async buffered, and resource-scoped).

**Standalone reflect():** `reflect()` now returns `{ reflected, record, usage? }` so callers can capture token usage without hooks.

**Examples**

```ts
// Via hooks
await memory.observe({
  threadId,
  messages,
  hooks: {
    onObservationEnd: ({ usage }) => {
      // usage: { inputTokens, outputTokens, totalTokens }
    },
    onReflectionEnd: ({ usage }) => {
      // usage: { inputTokens, outputTokens, totalTokens }
    },
  },
});

// Via standalone reflect()
const { reflected, usage } = await memory.reflect(threadId, resourceId);
```

Existing callbacks that accept no arguments continue to work without changes.
