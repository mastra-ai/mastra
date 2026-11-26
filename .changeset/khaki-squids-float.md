---
'@mastra/core': minor
---

Added end-to-end support for preserving OpenAI Responses compaction state across tool loops and memory reloads when using `store: false`. Mastra now persists the opaque compaction item and replays it on later requests in the same memory thread.

```ts
await agent.stream('Summarize the conversation', {
  memory: { thread: 'thread-1', resource: 'user-1' },
  providerOptions: {
    openai: {
      store: false,
      contextManagement: [{ type: 'compaction', compactThreshold: 10_000 }],
    },
  },
});
```

Fixes #20465.
