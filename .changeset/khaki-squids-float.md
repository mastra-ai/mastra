---
'@mastra/core': minor
---

Added end-to-end support for preserving OpenAI Responses compaction state across tool loops and memory reloads. Mastra now persists opaque compaction items and replays them on later requests in the same memory thread. With `store: false`, replay uses encrypted compaction content. With stored Responses, items with an OpenAI item ID replay as an `item_reference`.

Built-in `openai/*` Responses models, Netlify OpenAI models, custom URL models configured with `api: 'responses'`, `shape: 'responses'` overrides, and OpenAI WebSocket models now use `@ai-sdk/openai` 4.x instead of 3.x. This enables `contextManagement` and Language Model V4 behavior. When reasoning effort is enabled and `reasoningSummary` isn't set, 4.x defaults to detailed reasoning summaries, which can increase output tokens. Set `providerOptions.openai.reasoningSummary` explicitly to control this behavior.

```ts
await agent.stream('Summarize the conversation', {
  memory: { thread: 'thread-1', resource: 'user-1' },
  providerOptions: {
    openai: {
      store: false,
      contextManagement: [{ type: 'compaction', compactThreshold: 10_000 }],
    },
  },
})
```

When the selected history contains a compaction checkpoint, Mastra keeps the complete conversation in Memory while sending OpenAI only the latest checkpoint, system instructions, and messages after that checkpoint. Memory's history controls still determine which stored messages are selected before compaction is applied.

Fixes #20465.
