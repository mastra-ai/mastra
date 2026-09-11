---
'@mastra/core': patch
---

Scorer judge configuration now accepts an optional `modelSettings` field (temperature, topP, topK, maxOutputTokens, maxRetries, frequencyPenalty, presencePenalty, timeout, etc.), forwarded to the internal judge agent run. It can be set at the scorer level and overridden per step, removing the need for an input-processor workaround. Closes #23458.

```ts
const scorer = createScorer({
  id: 'my-scorer',
  name: 'my-scorer',
  description: 'Example scorer',
  judge: {
    model,
    instructions: 'Evaluate the response.',
    modelSettings: { temperature: 0.2, maxOutputTokens: 512 },
  },
});
```
