---
'@mastra/core': minor
---

Added `messageMetadata` to identified model configs. Mastra copies it onto every assistant message the model writes, both on the live `step-start` chunk and on the saved message. Each fallback model brings its own metadata, so a reply written after a fallback carries the fallback's values. `modelId`, `provider`, and `traceId` keep the values Mastra sets.

```ts
const agent = new Agent({
  id: 'support-agent',
  name: 'Support Agent',
  instructions: 'Answer support questions.',
  model: {
    id: 'openai/gpt-5',
    model: openai('gpt-5'),
    messageMetadata: { thinkingLevel: 'high' },
  },
});

// Each assistant message now has content.metadata.thinkingLevel === 'high'
```
