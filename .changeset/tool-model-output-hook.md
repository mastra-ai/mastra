---
'@mastra/core': minor
'@mastra/server': patch
'@mastra/client-js': patch
---

Added a `processToolModelOutput` processor hook that changes what the model reads from a tool result without changing the result itself. Use it to shorten, reformat, or redact the model-facing copy of a tool result while memory, message history, and streamed chunks keep the full result.

```ts
const shortener: Processor = {
  id: 'shortener',
  processToolModelOutput: ({ result }) => ({
    modelOutput: { type: 'text', value: JSON.stringify(result).slice(0, 2000) },
  }),
};
```

The hook runs after every `processToolResult` and after the tool's `toModelOutput`, on both the default and durable engines, for provider-executed tools, and for background task results. It doesn't run for client-side tools. Stored processor configs and the server accept the new `processToolModelOutput` phase.
