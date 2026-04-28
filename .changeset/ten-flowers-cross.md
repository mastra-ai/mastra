---
'@mastra/core': minor
---

Added agent execution timeouts to cap the total wall-clock runtime for generate and stream calls.

```ts
const agent = new Agent({
  id: 'weather-agent',
  name: 'Weather Agent',
  instructions: 'Answer weather questions.',
  model: openai('gpt-4o'),
  execution: {
    maxExecutionMs: 30_000,
    onTimeout: { strategy: 'fail' },
  },
});
```
